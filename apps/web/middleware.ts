import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { decide, requiredAccess } from "./lib/access";
import { routing } from "./i18n/routing";
import { tokenFromCookieHeader, userFromToken } from "./server/session";

const intl = createMiddleware(routing);
const LOCALE_PATH = new RegExp(`^/(${routing.locales.join("|")})(/.*)?$`);

/** next-intl for every page, plus login gating for app pages (UI-SPEC §3.3). Pages and APIs check again. */
export default async function middleware(req: NextRequest) {
  const m = LOCALE_PATH.exec(req.nextUrl.pathname);
  if (m) {
    const [, locale, rest = "/"] = m;
    const access = requiredAccess(rest);
    if (access !== "public") {
      const user = await userFromToken(tokenFromCookieHeader(req.headers.get("cookie"))).catch(() => null);
      const verdict = decide(access, user?.roles ?? null);
      if (verdict === "login") {
        const url = new URL(`/${locale}/login`, req.url);
        url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
        return NextResponse.redirect(url);
      }
      if (verdict === "forbidden")
        return NextResponse.rewrite(new URL(`/${locale}/forbidden`, req.url), { status: 403 });
    }
  }
  return intl(req);
}

// Everything except API routes, Next internals and files with an extension. Node runtime: the session lives in Postgres.
export const config = { matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"], runtime: "nodejs" };
