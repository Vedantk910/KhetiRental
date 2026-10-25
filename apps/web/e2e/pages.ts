// Every UI-SPEC §3.1 route, once, so the quality sweeps (a11y, layout, languages, motion, budgets, snapshots)
// all walk the same list.
import type { Browser, BrowserContext } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
import { freshIp, sql } from "./auth-helpers";

export type Area = "public" | "renter" | "owner" | "admin";
export type Ids = {
  machine: string;
  booking: string;
  payBooking: string;
  /** The machine that booking is for (the pay page refuses any other). */
  payMachine: string;
  request: string;
  ownerMachine: string;
};

export interface PageDef {
  name: string;
  area: Area;
  /** Path after the locale prefix. */
  path: (id: Ids) => string;
}

const p = (name: string, area: Area, path: PageDef["path"] | string): PageDef => ({
  name,
  area,
  path: typeof path === "string" ? () => path : path,
});

export const PAGES: PageDef[] = [
  p("welcome", "public", ""),
  p("login", "public", "/login"),
  p("signup", "public", "/login?mode=signup"),
  p("otp", "public", "/login/otp"),
  p("forgot", "public", "/login/forgot"),
  p("reset", "public", "/login/reset?token=sweep"),
  p("help", "public", "/help"),
  p("how-we-price", "public", "/how-we-price"),
  p("terms", "public", "/terms"),
  p("privacy", "public", "/privacy"),
  p("engineering", "public", "/about/engineering"),
  p("engineering-systems", "public", "/about/engineering/systems"),
  p("engineering-product", "public", "/about/engineering/product"),
  p("engineering-architecture", "public", "/about/engineering/architecture"),
  p("engineering-h3", "public", "/about/engineering/h3-spatial"),
  p("engineering-escrow", "public", "/about/engineering/escrow"),
  p("engineering-pricing", "public", "/about/engineering/pricing"),
  p("not-found", "public", "/no-such-page"),
  p("rent", "renter", "/rent"),
  p("results", "renter", "/rent/results?job=plough&place=413512&r=25"),
  p("detail", "renter", (i) => `/rent/m/${i.machine}`),
  p("book", "renter", (i) => `/rent/m/${i.machine}/book`),
  p("pay", "renter", (i) => `/rent/m/${i.payMachine}/book/pay?b=${i.payBooking}&method=upi`),
  p("bookings", "renter", "/bookings"),
  p("booking", "renter", (i) => `/bookings/${i.booking}`),
  p("problem", "renter", (i) => `/bookings/${i.booking}/problem`),
  p("notifications", "renter", "/notifications"),
  p("settings", "renter", "/settings"),
  p("owner", "owner", "/owner"),
  p("owner-new", "owner", "/owner/machines/new"),
  p("owner-edit", "owner", (i) => `/owner/machines/${i.ownerMachine}/edit`),
  p("owner-request", "owner", (i) => `/owner/requests/${i.request}`),
  p("admin", "admin", "/admin"),
];

const ACCOUNT: Record<Exclude<Area, "public">, string> = {
  renter: "sunil@khetirental.test",
  owner: "ramesh@khetirental.test",
  admin: "admin@khetirental.test",
};

/**
 * A browser context signed in as the seeded renter / owner / admin (or nobody), from its own fake IP. The session row
 * is written straight to the database, so a sweep of hundreds of pages never meets the password rate limit.
 */
export async function contextFor(
  browser: Browser,
  area: Area,
  viewport = { width: 390, height: 844 },
): Promise<BrowserContext> {
  const ctx = await browser.newContext({ viewport, extraHTTPHeaders: { "x-forwarded-for": freshIp() } });
  if (area === "public") return ctx;
  const token = randomBytes(32).toString("base64url");
  await sql(
    (s) => s`INSERT INTO sessions (session_token, user_id, expires)
      SELECT ${createHash("sha256").update(token).digest("hex")}, id, now() + interval '1 day'
      FROM users WHERE email = ${ACCOUNT[area]}`,
  );
  await ctx.addCookies([{ name: "authjs.session-token", value: token, domain: "localhost", path: "/" }]);
  return ctx;
}

/** Real rows from the seeded e2e database for the pages that need an id. */
export async function loadIds(): Promise<Ids> {
  return sql(async (s) => {
    const one = async (q: Promise<{ v: string }[]>) => (await q)[0].v;
    const payBooking = await one(s`SELECT b.id AS v FROM bookings b JOIN users u ON u.id = b.renter_id
        WHERE u.email = ${ACCOUNT.renter} AND b.status IN ('REQUESTED','CONFIRMED')
          AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.booking_id = b.id) ORDER BY b.code LIMIT 1`);
    return {
      payBooking,
      payMachine: await one(s`SELECT machine_id AS v FROM bookings WHERE id = ${payBooking}`),
      machine: await one(
        s`SELECT m.id AS v FROM machines m WHERE m.active AND m.rc_status = 'checked' ORDER BY m.id LIMIT 1`,
      ),
      booking: await one(s`SELECT b.code AS v FROM bookings b JOIN users u ON u.id = b.renter_id
        WHERE u.email = ${ACCOUNT.renter} AND b.status = 'COMPLETED' ORDER BY b.code LIMIT 1`),
      request:
        await one(s`SELECT b.code AS v FROM bookings b JOIN machines m ON m.id = b.machine_id JOIN users u ON u.id = m.owner_id
        WHERE u.email = ${ACCOUNT.owner} ORDER BY (b.status = 'REQUESTED') DESC, b.code LIMIT 1`),
      ownerMachine: await one(s`SELECT m.id AS v FROM machines m JOIN users u ON u.id = m.owner_id
        WHERE u.email = ${ACCOUNT.owner} ORDER BY m.id LIMIT 1`),
    };
  });
}
