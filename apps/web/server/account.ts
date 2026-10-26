// Settings (UI-SPEC §4.15): name, phone, roles, and deleting the account. Every function acts on the
// signed-in caller only; no id ever comes from the request.
import type { TransactionSql as Sql } from "postgres";
import { ACTIVE_STATUSES, type Role } from "@/lib/domain";
import { getSql, one } from "./db";
import { ApiError } from "./http";
import { deleteDraft } from "./drafts";
import { verifyOtp } from "./otp";
import type { SessionUser } from "./session";

const ACTIVE = [...ACTIVE_STATUSES];

export async function updateName(u: SessionUser, name: string) {
  await getSql()`UPDATE users SET name = ${name} WHERE id = ${u.id}`;
  return { name };
}

/** The code must have been sent to the NEW number, so nobody can claim a number they don't hold. */
export async function changePhone(u: SessionUser, rawPhone: string, code: string) {
  const phone = await verifyOtp(rawPhone, code);
  try {
    await getSql()`UPDATE users SET phone = ${phone}, phone_verified_at = now() WHERE id = ${u.id}`;
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new ApiError(409, "phone_taken", "phone");
    throw e;
  }
  return { phone };
}

/** Bookings that hold a machine, as renter or on one of the caller's machines. */
const liveBookings = (tx: Sql, userId: string, as: "renter" | "owner") =>
  as === "renter"
    ? tx<
        { n: number }[]
      >`SELECT count(*)::int AS n FROM bookings WHERE renter_id = ${userId} AND status = ANY(${ACTIVE}::text[])`
    : tx<{ n: number }[]>`SELECT count(*)::int AS n FROM bookings b JOIN machines m ON m.id = b.machine_id
                          WHERE m.owner_id = ${userId} AND b.status = ANY(${ACTIVE}::text[])`;

/** Takes the per-machine lock the booking insert takes, then hides the machines: no booking can slip in after this. */
async function pauseMachines(tx: Sql, ownerId: string) {
  const ms = await tx<{ id: string }[]>`SELECT id FROM machines WHERE owner_id = ${ownerId} ORDER BY id`;
  for (const m of ms) await tx`SELECT pg_advisory_xact_lock(hashtextextended(${m.id}, 0))`;
  await tx`UPDATE machines SET active = false WHERE owner_id = ${ownerId}`;
}

/**
 * Turns the renter and owner roles on or off. Admin is never touched here. A role can't be switched off
 * while it has live bookings; switching owner off pauses the listings (they stay for booking history).
 */
export async function setMyRoles(u: SessionUser, want: { renter: boolean; owner: boolean }) {
  if (!want.renter && !want.owner) throw new ApiError(400, "invalid_request", "renter");
  return getSql().begin(async (tx) => {
    const cur = one(await tx<{ roles: Role[] }[]>`SELECT roles FROM users WHERE id = ${u.id} FOR UPDATE`);
    if (!cur) throw new ApiError(401, "unauthorized");
    for (const role of ["renter", "owner"] as const) {
      if (want[role] || !cur.roles.includes(role)) continue;
      if (role === "owner") await pauseMachines(tx, u.id);
      if ((await liveBookings(tx, u.id, role))[0].n > 0) throw new ApiError(409, "active_bookings");
    }
    // Stored order stays renter, owner, admin so pages don't reshuffle.
    const ordered = (["renter", "owner", "admin"] as const).filter((r) =>
      r === "admin" ? cur.roles.includes("admin") : want[r],
    );
    await tx`UPDATE users SET roles = ${ordered} WHERE id = ${u.id}`;
    return { roles: ordered };
  });
}

/**
 * Deletes the account the careful way. Bookings, reviews and reports of other people point at this row,
 * so it is anonymised, not removed: every personal field and every way to sign in is wiped, the sessions
 * are dropped, the listings are paused. Refused while a live booking involves the person (as renter or
 * on their machines), or for an admin. One transaction: a refusal changes nothing.
 */
export async function deleteAccount(u: SessionUser) {
  if (u.roles.includes("admin")) throw new ApiError(403, "forbidden");
  await getSql().begin(async (tx) => {
    const me = one(
      await tx<{ phone: string | null; email: string | null }[]>`
      SELECT phone, email FROM users WHERE id = ${u.id} AND deleted_at IS NULL FOR UPDATE`,
    );
    if (!me) throw new ApiError(401, "unauthorized");
    await pauseMachines(tx, u.id);
    const mine = (await liveBookings(tx, u.id, "renter"))[0].n + (await liveBookings(tx, u.id, "owner"))[0].n;
    if (mine > 0) throw new ApiError(409, "active_bookings");
    await tx`DELETE FROM sessions WHERE user_id = ${u.id}`;
    await tx`DELETE FROM accounts WHERE user_id = ${u.id}`;
    await tx`DELETE FROM notifications WHERE user_id = ${u.id}`;
    if (me.phone) await tx`DELETE FROM otp_codes WHERE phone = ${me.phone}`;
    if (me.email) await tx`DELETE FROM verification_tokens WHERE identifier = ${me.email}`;
    await tx`DELETE FROM verification_tokens WHERE identifier LIKE ${`email-change:${u.id}:%`}`;
    await tx`
      UPDATE users SET name = NULL, email = NULL, email_verified = NULL, image = NULL, phone = NULL,
        phone_verified_at = NULL, password_hash = NULL, roles = ARRAY['renter'], deleted_at = now()
      WHERE id = ${u.id}`;
  });
  await deleteDraft(u.id);
}
