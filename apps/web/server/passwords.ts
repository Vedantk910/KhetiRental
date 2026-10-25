// Email + password (D-05): argon2id hashes, ≥ 8 characters, a reset link sent by email (logged in dev).
import { hash, verify } from "@node-rs/argon2";
import { createHmac, randomBytes } from "node:crypto";
import { getSql, one } from "./db";
import { ApiError, parse } from "./http";
import { sendMail, siteUrl } from "./mail";
import { limit } from "./rate-limit";
import { authSecret } from "./secret";
import type { SessionUser } from "./session";
import { emailSchema, passwordSchema, resetSchema, signupSchema } from "./validation";

const RESET_TTL_S = 3600;
// Verified against when the email is unknown, so timing doesn't reveal which emails exist.
let dummyHash: Promise<string> | undefined;

export const hashPassword = (pw: string) => hash(pw);

export async function signup(input: unknown): Promise<SessionUser> {
  const { name, email, password, roles } = parse(signupSchema, input);
  const passwordHash = await hashPassword(password);
  try {
    const [u] = await getSql()<SessionUser[]>`
      INSERT INTO users (name, email, password_hash, roles) VALUES (${name}, ${email}, ${passwordHash}, ${roles})
      RETURNING id, name, email, phone, roles`;
    return u;
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new ApiError(409, "email_taken", "email");
    throw e;
  }
}

/** null for any wrong email/password combination (UI-SPEC §4.2: never say which). */
export async function loginWithPassword(
  rawEmail: string,
  password: string,
  ip: string,
): Promise<SessionUser | null> {
  const email = emailSchema.safeParse(rawEmail);
  if (!email.success || !passwordSchema.safeParse(password).success) return null;
  await limit("passwordIp", ip);
  await limit("passwordAccount", email.data);
  const u = one(
    await getSql()<(SessionUser & { password_hash: string | null })[]>`
    SELECT id, name, email, phone, roles, password_hash FROM users WHERE email = ${email.data}`,
  );
  if (!u?.password_hash) {
    await verify(await (dummyHash ??= hash("not-a-real-password")), password);
    return null;
  }
  if (!(await verify(u.password_hash, password))) return null;
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, roles: u.roles };
}

const tokenHash = (t: string) => createHmac("sha256", authSecret()).update(t).digest("hex");

/** Returns the token (for the caller to email) or null when no such account; callers show the same message either way. */
export async function requestPasswordReset(rawEmail: string): Promise<string | null> {
  const email = parse(emailSchema, rawEmail);
  const sql = getSql();
  const u = one(await sql<{ id: string }[]>`SELECT id FROM users WHERE email = ${email}`);
  if (!u) return null;
  const token = randomBytes(24).toString("base64url");
  await sql`DELETE FROM verification_tokens WHERE identifier = ${`reset:${email}`}`;
  await sql`INSERT INTO verification_tokens (identifier, token, expires)
            VALUES (${`reset:${email}`}, ${tokenHash(token)}, now() + make_interval(secs => ${RESET_TTL_S}))`;
  return token;
}

/** Absolute reset link on the configured site, or null when SITE_URL is not usable (nothing is sent then). */
export function resetLink(token: string) {
  const base = siteUrl();
  return base && `${base}/login/reset?token=${token}`;
}

export async function sendResetEmail(email: string, token: string) {
  const link = resetLink(token);
  if (!link) {
    console.error("[mail] SITE_URL is not set; password reset email not sent");
    return;
  }
  await sendMail({
    to: email,
    subject: "Reset your KhetiRental password",
    text: `Open this link to choose a new password. It works once and expires in 1 hour.\n\n${link}\n\nIf you did not ask for this, ignore this email.`,
  });
}

export async function resetPassword(token: string, password: string) {
  const input = parse(resetSchema, { token, password });
  const sql = getSql();
  const passwordHash = await hashPassword(input.password);
  await sql.begin(async (tx) => {
    const row = one(
      await tx<{ identifier: string; live: boolean }[]>`
      DELETE FROM verification_tokens WHERE token = ${tokenHash(input.token)} AND identifier LIKE 'reset:%'
      RETURNING identifier, expires > now() AS live`,
    );
    if (!row?.live) throw new ApiError(400, "token_invalid", "token");
    const email = row.identifier.slice("reset:".length);
    const u = one(
      await tx<
        { id: string }[]
      >`UPDATE users SET password_hash = ${passwordHash} WHERE email = ${email} RETURNING id`,
    );
    if (u) await tx`DELETE FROM sessions WHERE user_id = ${u.id}`;
  });
}
