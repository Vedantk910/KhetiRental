const APP_PREFIXES = ["/rent", "/bookings", "/owner", "/notifications", "/settings"];

/** `href` is the current section: exact match or a sub-path (not a look-alike prefix). */
export const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

/** Logged-in app pages that get the phone tab bar (UI-SPEC §3.2). */
export const isAppRoute = (pathname: string) => APP_PREFIXES.some((p) => isActive(pathname, p));

/** Footer: public pages and the bottom of /rent. */
export const showFooter = (pathname: string) => pathname === "/rent" || !isAppRoute(pathname);
