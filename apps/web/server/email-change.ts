// Settings → change email. The new address must prove itself: a single-use token (30 min, stored hashed) is
// mailed there and only the signed-in requester can redeem it. The old address is told afterwards. Sessions
// stay valid; a Google link is keyed by Google's account id, so it survives the change.
import { verify } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";
import { getSql, one } from "./db";
import { ApiError } from "./http";
import { mailConfigured, sendMail, siteUrl } from "./mail";
import { mocksMayLog } from "./mocks/flags";
import { tokenHash } from "./passwords";
import { limit } from "./rate-limit";
import type { SessionUser } from "./session";

const TTL_S = 30 * 60;
const prefix = (userId: string) => `email-change:${userId}:`;

/** The link base, or 503 when this deployment cannot deliver mail (no SITE_URL, or no SMTP outside dev). */
function linkBase() {
  const base = siteUrl();
  if (!base || !(mailConfigured() || mocksMayLog())) throw new ApiError(503, "mail_unavailable");
  return base;
}

/** Returns the confirm token only where the mail mock may print it (dev and e2e), for the page to show. */
export async function requestEmailChange(
  u: SessionUser,
  input: { email: string; password?: string },
  ip: string,
): Promise<{ devLink?: string }> {
  const base = linkBase();
  await limit("emailChangeIp", ip);
  await limit("emailChangeUser", u.id);
  const sql = getSql();
  const me = one(
    await sql<{ email: string | null; password_hash: string | null }[]>`
    SELECT email, password_hash FROM users WHERE id = ${u.id} AND deleted_at IS NULL`,
  );
  if (!me) throw new ApiError(401, "unauthorized");
  // A stolen session alone can't take the account over: a password account must prove the password too.
  if (me.password_hash) {
    if (!input.password) throw new ApiError(400, "invalid_request", "password");
    if (!(await verify(me.password_hash, input.password)))
      throw new ApiError(400, "password_wrong", "password");
  }
  if (input.email === me.email) throw new ApiError(400, "email_same", "email");
  // Same disclosure as sign-up: an address in use is refused.
  if (one(await sql`SELECT 1 FROM users WHERE email = ${input.email}`))
    throw new ApiError(409, "email_taken", "email");
  await limit("emailChangeTarget", input.email);

  const token = randomBytes(24).toString("base64url");
  const identifier = `${prefix(u.id)}${input.email}`;
  await sql.begin(async (tx) => {
    await tx`DELETE FROM verification_tokens WHERE identifier LIKE ${`${prefix(u.id)}%`}`;
    await tx`INSERT INTO verification_tokens (identifier, token, expires)
             VALUES (${identifier}, ${tokenHash(token)}, now() + make_interval(secs => ${TTL_S}))`;
  });
  const link = `${base}/settings/email?token=${token}`;
  try {
    await sendMail({
      to: input.email,
      subject: "Confirm your new KhetiRental email",
      text: `Open this link while you are signed in to KhetiRental to use this address. It works once and expires in 30 minutes.\n\n${link}\n\nIf you did not ask for this, ignore this email.`,
    });
  } catch (e) {
    console.error("[mail] email change link failed", e);
    await sql`DELETE FROM verification_tokens WHERE identifier = ${identifier}`;
    throw new ApiError(503, "mail_unavailable");
  }
  return mocksMayLog() && !mailConfigured() ? { devLink: `/settings/email?token=${token}` } : {};
}

export async function confirmEmailChange(u: SessionUser, token: string, ip: string) {
  await limit("emailConfirmIp", ip);
  const sql = getSql();
  const { oldEmail, email } = await sql.begin(async (tx) => {
    // Matching on this user's own prefix means another account's token is neither accepted nor consumed.
    const row = one(
      await tx<{ identifier: string; live: boolean }[]>`
      DELETE FROM verification_tokens WHERE token = ${tokenHash(token)} AND identifier LIKE ${`${prefix(u.id)}%`}
      RETURNING identifier, expires > now() AS live`,
    );
    if (!row?.live) throw new ApiError(400, "token_invalid", "token");
    const email = row.identifier.slice(prefix(u.id).length);
    const cur = one(
      await tx<
        { email: string | null }[]
      >`SELECT email FROM users WHERE id = ${u.id} AND deleted_at IS NULL FOR UPDATE`,
    );
    if (!cur) throw new ApiError(401, "unauthorized");
    try {
      await tx`UPDATE users SET email = ${email}, email_verified = now() WHERE id = ${u.id}`;
    } catch (e) {
      if ((e as { code?: string }).code === "23505") throw new ApiError(409, "email_taken", "email");
      throw e;
    }
    // Links aimed at the old address (password resets) must not outlive it.
    if (cur.email) await tx`DELETE FROM verification_tokens WHERE identifier = ${`reset:${cur.email}`}`;
    return { oldEmail: cur.email, email };
  });
  if (oldEmail)
    await sendMail({
      to: oldEmail,
      subject: "Your KhetiRental email was changed",
      text: `The email on your KhetiRental account is now ${email}. If this was not you, reset your password and contact the helpline.`,
    }).catch((e: unknown) => {
      console.error("[mail] old-address notice failed", e);
    });
  return { email };
}
