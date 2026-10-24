// Database sessions. The cookie holds a random token; the sessions table holds only its sha256,
// so a leaked table can't be replayed. Auth.js mints sessions through createSession (server/auth.ts).
import { createHash, randomBytes } from "node:crypto";
import type { Role } from "@/lib/domain";
import { getSql, one } from "./db";
import { ApiError } from "./http";

export const SESSION_MAX_AGE_S = 30 * 86_400;
const SESSION_COOKIES = ["__Secure-authjs.session-token", "authjs.session-token"];

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await getSql()`
    INSERT INTO sessions (session_token, user_id, expires)
    VALUES (${hashToken(token)}, ${userId}, now() + make_interval(secs => ${SESSION_MAX_AGE_S}))`;
  return token;
}

export async function deleteSession(token: string) {
  await getSql()`DELETE FROM sessions WHERE session_token = ${hashToken(token)}`;
}

export interface SessionUser {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  roles: Role[];
}

export async function userFromToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token || token.length > 200) return null;
  const u = one(
    await getSql()<SessionUser[]>`
    SELECT u.id, u.name, u.email, u.phone, u.roles
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.session_token = ${hashToken(token)} AND s.expires > now()`,
  );
  return u ?? null;
}

export function tokenFromCookieHeader(header: string | null): string | undefined {
  if (!header) return undefined;
  const jar = new Map(
    header.split(";").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()] as const;
    }),
  );
  for (const name of SESSION_COOKIES) if (jar.get(name)) return jar.get(name);
  return undefined;
}

export const currentUser = (req: Request) => userFromToken(tokenFromCookieHeader(req.headers.get("cookie")));

export async function requireUser(req: Request): Promise<SessionUser> {
  const u = await currentUser(req);
  if (!u) throw new ApiError(401, "unauthorized");
  return u;
}

export function requireRole(u: SessionUser, role: Role) {
  if (!u.roles.includes(role) && !u.roles.includes("admin")) throw new ApiError(403, "forbidden");
}
