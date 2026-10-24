import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { postLoginPath } from "@/lib/access";
import { tokenFromCookieHeader, userFromToken, type SessionUser } from "./session";

/** The signed-in user of this page request, or null (also when the database is unreachable: pages stay public). */
export async function pageUser(): Promise<SessionUser | null> {
  const cookie = (await headers()).get("cookie");
  return userFromToken(tokenFromCookieHeader(cookie)).catch(() => null);
}

/** Login pages send signed-in people on their way (UI-SPEC §3.3). */
export async function redirectIfSignedIn(locale: string, next: string | null) {
  const u = await pageUser();
  if (u) redirect(postLoginPath(locale, u.roles, next));
}
