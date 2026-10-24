// Who may open which page (UI-SPEC §3.1, §3.3). Pure, so middleware and pages share one rule.
import type { Role } from "./domain";
import { isActive } from "./nav";

export type Access = "public" | "user" | "owner" | "admin";

/** `path` is without the locale prefix. */
export function requiredAccess(path: string): Access {
  if (isActive(path, "/admin")) return "admin";
  // Renters see "Turn on owner mode" on the listing wizard, so it only needs a login.
  if (isActive(path, "/owner/machines/new")) return "user";
  if (isActive(path, "/owner")) return "owner";
  if (["/rent", "/bookings", "/notifications", "/settings"].some((p) => isActive(path, p))) return "user";
  return "public";
}

export function decide(access: Access, roles: Role[] | null): "allow" | "login" | "forbidden" {
  if (access === "public") return "allow";
  if (!roles) return "login";
  if (access === "user" || roles.includes("admin") || roles.includes(access)) return "allow";
  return "forbidden";
}

/** Only same-site paths survive as ?next= targets. */
export function safeNext(next: string | null): string | null {
  return next && /^\/(?![/\\])/.test(next) ? next : null;
}

export function postLoginPath(
  locale: string,
  roles: Role[],
  next: string | null,
  newOwnerSignup = false,
): string {
  const safe = safeNext(next);
  if (safe) return safe;
  if (newOwnerSignup) return `/${locale}/owner/machines/new`;
  return roles.includes("owner") && !roles.includes("renter") ? `/${locale}/owner` : `/${locale}/rent`;
}
