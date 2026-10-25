// @vitest-environment node
// M7: account settings and deletion. Adversarial: logged-out callers, one user against another, replays,
// session reuse after delete, active bookings on either side, hostile input.
import { DELETE as deleteMe, PATCH as patchMe } from "@/app/api/me/route";
import { POST as phoneRoute } from "@/app/api/me/phone/route";
import { PUT as rolesRoute } from "@/app/api/me/roles/route";
import { POST as createRoute } from "@/app/api/bookings/route";
import { POST as acceptRoute } from "@/app/api/bookings/[id]/accept/route";
import { POST as cancelRoute } from "@/app/api/bookings/[id]/cancel/route";
import { GET as meRoute } from "@/app/api/me/route";
import { sendOtp } from "./otp";
import { getSql } from "./db";
import { createBooking } from "./bookings";
import { createSession, userFromToken, type SessionUser } from "./session";
import { inDays, json, makeMachine, makeUser, req, type TestUser } from "./test/fixtures";
import { createTestDb, type TestDb } from "./test/pg";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
  process.env.DEMO_PAYMENT_DELAY_MS = "0";
});
afterAll(() => t.drop());

const p = <P>(x: P) => ({ params: Promise.resolve(x) });
const none = p<Record<string, never>>({});
const del = (u: TestUser | null, body: unknown = { confirm: "DELETE" }) =>
  deleteMe(req("/api/me", json(body, { cookie: u?.cookie, method: "DELETE" })), none);
const book = (u: TestUser, machineId: string, offset: number) =>
  createRoute(
    req(
      "/api/bookings",
      json(
        { machineId, startDate: inDays(offset), endDate: inDays(offset), slot: "full", qty: 4 },
        { cookie: u.cookie, headers: { "idempotency-key": crypto.randomUUID() } },
      ),
    ),
    none,
  );
const row = async (id: string) =>
  (await getSql()`SELECT * FROM users WHERE id = ${id}`)[0] as Record<string, unknown> | undefined;

describe("logged-out callers", () => {
  it("every account endpoint answers 401", async () => {
    expect((await del(null)).status).toBe(401);
    expect((await patchMe(req("/api/me", json({ name: "Ravi" }, { method: "PATCH" })), none)).status).toBe(
      401,
    );
    expect(
      (await phoneRoute(req("/api/me/phone", json({ phone: "9876543210", code: "123456" })), none)).status,
    ).toBe(401);
    expect(
      (await rolesRoute(req("/api/me/roles", json({ renter: true, owner: true }, { method: "PUT" })), none))
        .status,
    ).toBe(401);
  });
});

describe("deleting an account", () => {
  it("requires the exact word DELETE", async () => {
    const u = await makeUser();
    for (const body of [
      {},
      { confirm: "delete" },
      { confirm: "DELETE " },
      { confirm: "DELETE", id: u.id },
      null,
      [],
    ]) {
      expect((await del(u, body)).status, JSON.stringify(body)).toBe(400);
    }
    expect((await row(u.id))!.deleted_at).toBeNull();
  });

  it("anonymises the row, drops every session and login method, clears the cookie", async () => {
    const phone = "+919812300001";
    const u = await makeUser(["renter"], { phone });
    await getSql()`UPDATE users SET password_hash = 'x', image = 'i', name = 'Ravi Patil' WHERE id = ${u.id}`;
    await getSql()`INSERT INTO accounts (user_id, type, provider, provider_account_id) VALUES (${u.id}, 'oidc', 'google', ${`g-${u.id}`})`;
    const other = await createSession(u.id);
    const res = await del(u);
    expect(res.status).toBe(200);
    expect(res.headers.getSetCookie().join(";")).toMatch(/authjs\.session-token=;/);
    const r = (await row(u.id))!;
    expect([
      r.name,
      r.email,
      r.phone,
      r.password_hash,
      r.image,
      r.email_verified,
      r.phone_verified_at,
    ]).toEqual([null, null, null, null, null, null, null]);
    expect(r.deleted_at).not.toBeNull();
    expect(r.roles).toEqual(["renter"]);
    expect(await getSql()`SELECT 1 FROM sessions WHERE user_id = ${u.id}`).toHaveLength(0);
    expect(await getSql()`SELECT 1 FROM accounts WHERE user_id = ${u.id}`).toHaveLength(0);
    // session reuse after delete
    expect(await userFromToken(u.token)).toBeNull();
    expect(await userFromToken(other)).toBeNull();
    expect((await meRoute(req("/api/me", { headers: { cookie: u.cookie } }), none)).status).toBe(401);
  });

  it("a replayed delete is refused (the session is gone)", async () => {
    const u = await makeUser();
    expect((await del(u)).status).toBe(200);
    expect((await del(u)).status).toBe(401);
  });

  it("a deleted session row that was re-inserted still does not resolve (deleted_at guard)", async () => {
    const u = await makeUser();
    await del(u);
    const token = await createSession(u.id);
    expect(await userFromToken(token)).toBeNull();
  });

  it("frees the phone: the same number can sign up again as a new person", async () => {
    const phone = "+919812300002";
    const u = await makeUser(["renter"], { phone });
    await del(u);
    const again = await makeUser(["renter"], { phone });
    expect(again.id).not.toBe(u.id);
  });

  it("refuses an admin", async () => {
    const a = await makeUser(["admin"]);
    expect((await del(a)).status).toBe(403);
    expect((await row(a.id))!.deleted_at).toBeNull();
  });

  it("cannot be aimed at someone else: the body has no id and the cookie decides", async () => {
    const victim = await makeUser();
    const attacker = await makeUser();
    expect((await del(attacker, { confirm: "DELETE", userId: victim.id })).status).toBe(400);
    expect((await row(victim.id))!.deleted_at).toBeNull();
    expect((await del(attacker)).status).toBe(200);
    expect((await row(victim.id))!.deleted_at).toBeNull();
    expect(await userFromToken(victim.token)).not.toBeNull();
  });

  it("refuses while the renter has an active booking, then works once it is cancelled", async () => {
    const owner = await makeUser(["owner"]);
    const renter = await makeUser();
    const machineId = await makeMachine(owner.id);
    const b = await (await book(renter, machineId, 6)).json();
    const res = await del(renter);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("active_bookings");
    expect((await row(renter.id))!.deleted_at).toBeNull();
    expect(await userFromToken(renter.token)).not.toBeNull();
    await cancelRoute(
      req(`/api/bookings/${b.id}/cancel`, json({ reason: "plans" }, { cookie: renter.cookie })),
      p({ id: b.id }),
    );
    expect((await del(renter)).status).toBe(200);
    // history survives for the owner
    const kept = await getSql()`SELECT renter_id FROM bookings WHERE id = ${b.id}`;
    expect(kept[0].renter_id).toBe(renter.id);
  });

  it("refuses while someone has an active booking on the owner's machine; a quiet owner is deleted and the listing paused", async () => {
    const owner = await makeUser(["owner"]);
    const renter = await makeUser();
    const m1 = await makeMachine(owner.id);
    const m2 = await makeMachine(owner.id);
    const b = await (await book(renter, m1, 7)).json();
    await acceptRoute(
      req(`/api/bookings/${b.id}/accept`, json({}, { cookie: owner.cookie })),
      p({ id: b.id }),
    );
    expect((await del(owner)).status).toBe(409);
    // a refused delete must not have paused anything
    expect((await getSql()`SELECT active FROM machines WHERE id = ${m2}`)[0].active).toBe(true);
    await cancelRoute(
      req(`/api/bookings/${b.id}/cancel`, json({ reason: "plans" }, { cookie: owner.cookie })),
      p({ id: b.id }),
    );
    expect((await del(owner)).status).toBe(200);
    const ms = await getSql()`SELECT active FROM machines WHERE owner_id = ${owner.id}`;
    expect(ms.map((m) => m.active)).toEqual([false, false]);
  });

  it("a deleted owner's machine can no longer be booked, and a deleted renter can't book", async () => {
    const owner = await makeUser(["owner"]);
    const renter = await makeUser();
    const machineId = await makeMachine(owner.id);
    await del(owner);
    expect((await book(renter, machineId, 9)).status).toBe(404);
    const gone = await makeUser();
    const m = await makeMachine((await makeUser(["owner"])).id);
    await del(gone);
    expect((await book(gone, m, 9)).status).toBe(401);
  });

  it("a request already in flight when the account or machine goes away still can't create a booking", async () => {
    const owner = await makeUser(["owner"]);
    const renter = await makeUser();
    const machineId = await makeMachine(owner.id);
    const stale = { id: renter.id, name: null, email: null, phone: null, roles: ["renter"] } as SessionUser;
    const input = { machineId, startDate: inDays(12), endDate: inDays(12), slot: "full", qty: 4 } as const;
    await getSql()`UPDATE users SET deleted_at = now() WHERE id = ${renter.id}`;
    await expect(createBooking(stale, input, crypto.randomUUID())).rejects.toMatchObject({ status: 404 });
    const r2 = await makeUser();
    const m2 = await makeMachine(owner.id);
    await getSql()`UPDATE machines SET active = false WHERE id = ${m2}`;
    await expect(
      createBooking(r2 as never, { ...input, machineId: m2 }, crypto.randomUUID()),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("8 users deleting at once all succeed exactly once; replays all fail", async () => {
    const users = await Promise.all(Array.from({ length: 8 }, () => makeUser()));
    const first = await Promise.all(users.map((u) => del(u)));
    expect(first.map((r) => r.status)).toEqual(Array(8).fill(200));
    const again = await Promise.all(users.map((u) => del(u)));
    expect(again.map((r) => r.status)).toEqual(Array(8).fill(401));
  });
});

describe("profile and roles", () => {
  it("renames only the caller; hostile names are rejected or stored as plain text", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const patch = (u: TestUser, body: unknown) =>
      patchMe(req("/api/me", json(body, { cookie: u.cookie, method: "PATCH" })), none);
    expect((await patch(a, { name: "Sita Devi" })).status).toBe(200);
    expect((await row(a.id))!.name).toBe("Sita Devi");
    expect((await row(b.id))!.name).not.toBe("Sita Devi");
    for (const bad of [
      { name: "x" },
      { name: "y".repeat(81) },
      { name: 5 },
      { name: "A", id: b.id },
      { id: b.id, name: "Zed Zed" },
      {},
    ])
      expect((await patch(a, bad)).status, JSON.stringify(bad)).toBe(400);
    expect((await patch(a, { name: "<script>alert(1)</script>" })).status).toBe(200);
    expect((await row(a.id))!.name).toBe("<script>alert(1)</script>");
    expect((await row(b.id))!.roles).toEqual(["renter"]);
  });

  it("role switch: needs one role, never grants admin, and turning a role off is refused with active bookings", async () => {
    const owner = await makeUser(["owner"]);
    const renter = await makeUser(["renter"]);
    const put = (u: TestUser, body: unknown) =>
      rolesRoute(req("/api/me/roles", json(body, { cookie: u.cookie, method: "PUT" })), none);
    expect((await put(renter, { renter: false, owner: false })).status).toBe(400);
    expect((await put(renter, { renter: true, owner: true, admin: true })).status).toBe(400);
    expect((await put(renter, { renter: true, owner: true })).status).toBe(200);
    expect((await row(renter.id))!.roles).toEqual(["renter", "owner"]);
    const admin = await makeUser(["admin", "renter"]);
    expect((await put(admin, { renter: true, owner: true })).status).toBe(200);
    expect((await row(admin.id))!.roles).toContain("admin");
    // owner with a live booking can't switch off
    const machineId = await makeMachine(owner.id);
    await put(owner, { renter: true, owner: true });
    await book(renter, machineId, 11);
    const off = await put(owner, { renter: true, owner: false });
    expect(off.status).toBe(409);
    expect((await row(owner.id))!.roles).toContain("owner");
    // and a renter with a live booking can't switch renter off
    await put(renter, { renter: true, owner: true });
    expect((await put(renter, { renter: false, owner: true })).status).toBe(409);
  });

  it("changing the phone needs a code for the NEW number; taken numbers are refused; the old number is freed", async () => {
    const a = await makeUser(["renter"], { phone: "+919812300010" });
    const b = await makeUser(["renter"], { phone: "+919812300011" });
    const change = (u: TestUser, phone: string, code: string) =>
      phoneRoute(req("/api/me/phone", json({ phone, code }, { cookie: u.cookie })), none);
    expect((await change(a, "9812300012", "000000")).status).toBe(400); // no code was sent
    const sent = await sendOtp("9812300012", "10.0.0.1");
    expect((await change(a, "9812300012", sent.devCode === "111111" ? "222222" : "111111")).status).toBe(400);
    // a code for one number is no good for another
    expect((await change(a, "9812300019", sent.devCode!)).status).toBe(400);
    expect((await change(a, "9812300012", sent.devCode!)).status).toBe(200);
    expect((await row(a.id))!.phone).toBe("+919812300012");
    // the code was used up
    expect((await change(a, "9812300012", sent.devCode!)).status).toBe(400);
    // taking another user's number is a conflict even with a valid code; b keeps theirs
    const taken = await sendOtp("9812300011", "10.0.0.3");
    expect((await change(a, "9812300011", taken.devCode!)).status).toBe(409);
    expect((await row(b.id))!.phone).toBe("+919812300011");
    expect((await row(a.id))!.phone).toBe("+919812300012");
  });
});
