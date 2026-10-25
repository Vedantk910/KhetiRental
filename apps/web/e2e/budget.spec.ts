// REVIEW §0.4: first-load JavaScript, gzipped, measured on the wire (the compressed bytes Chromium really received)
// from the production build. Targets: <= 120 kB per app page, <= 90 kB for the welcome page in lite mode (not counting
// the lazy 3D chunk).
//
// Next 15 + React 19 alone send about 106 kB (react-dom 54, Next's client runtime 46, webpack/main 3), so today's pages
// sit well above those targets (see CEILING). Until they come down, this spec enforces a CEILING per page that was
// measured on the current build: any growth fails, and the gap to the target is printed for every page.
//   npm run test:budget                 regressions only
//   STRICT_BUDGET=1 npm run test:budget the real §0.4 targets (fails today)
import { expect, test } from "@playwright/test";
import { contextFor, loadIds, PAGES, type Ids } from "./pages";

const KB = 1000; // Next prints kB the same way
const TARGET_APP = 120 * KB;
const TARGET_WELCOME = 90 * KB;
const STRICT = !!process.env.STRICT_BUDGET;

/** Measured first-load JS (kB, gzip) on the current build, plus a little headroom. Lower these as the pages shrink. */
const CEILING_KB: Record<string, number> = {
  welcome: 150,
  login: 163,
  signup: 163,
  otp: 160,
  forgot: 159,
  reset: 159,
  help: 146,
  "how-we-price": 151,
  terms: 150,
  privacy: 150,
  engineering: 154,
  "engineering-systems": 154,
  "engineering-product": 154,
  "engineering-architecture": 154,
  "engineering-h3": 225, // the practice map needs h3-js (63 kB) by design
  "engineering-escrow": 158,
  "engineering-pricing": 158,
  rent: 162,
  results: 159,
  detail: 156,
  book: 162,
  pay: 150,
  bookings: 158,
  booking: 150,
  problem: 151,
  notifications: 152,
  settings: 157,
  owner: 162,
  "owner-new": 168,
  "owner-edit": 163,
  "owner-request": 151,
  admin: 155,
};

// REVIEW P-01 / P-03: the H3 library and the charting library stay out of every other page's browser bundle.
const HEAVY = /_sizeOfH3Index|recharts-wrapper/;

let ids: Ids;
test.beforeAll(async () => {
  ids = await loadIds();
});

for (const def of PAGES.filter((d) => d.name !== "not-found")) {
  test(`first-load JS: ${def.name}`, async ({ browser }) => {
    const ctx = await contextFor(browser, def.area);
    const page = await ctx.newPage();
    // Low-end phone: the welcome page picks its lite scene.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 2 });
    });
    const bodies = new Map<string, string>();
    page.on("response", async (r) => {
      if (r.request().resourceType() === "script") bodies.set(r.url(), await r.text().catch(() => ""));
    });

    const nav = await page.goto(`/en${def.path(ids)}`, { waitUntil: "load" });
    // First load = the scripts the HTML itself asks for. Chunks Next prefetches for other routes, or that a page
    // imports later (map, 3D), come on top and are reported as "all" but not budgeted.
    const html = await nav!.text();
    const initial = new Set(
      [...html.matchAll(/<script\b[^>]*>/g)]
        .map((m) => m[0])
        .filter((tag) => !/\bnoModule\b/i.test(tag))
        .map((tag) => /\bsrc="([^"]+\.js[^"]*)"/.exec(tag)?.[1])
        .filter((u): u is string => !!u)
        .map((u) => new URL(u, page.url()).href),
    );
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    // encodedBodySize = the compressed body Chromium received, without response headers.
    const entries = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .filter((e) => (e as PerformanceResourceTiming).initiatorType === "script" || e.name.endsWith(".js"))
        .map((e) => ({ url: e.name, bytes: (e as PerformanceResourceTiming).encodedBodySize })),
    );
    const sum = (l: { bytes: number }[]) => l.reduce((n, s) => n + s.bytes, 0);
    // The lazy 3D chunk (three.js) is excluded by definition.
    const is3d = (u: string) => (bodies.get(u) ?? "").includes("WebGLRenderer");
    const counted = entries.filter((s) => initial.has(s.url) && !is3d(s.url));
    const bytes = sum(counted);
    const all = sum(entries.filter((s) => !is3d(s.url)));

    const target = def.name === "welcome" ? TARGET_WELCOME : TARGET_APP;
    const ceiling = CEILING_KB[def.name] * KB;
    console.log(
      `JSBUDGET ${def.name.padEnd(26)} ${(bytes / KB).toFixed(1).padStart(6)} kB  target ${target / KB}  gap ${((bytes - target) / KB).toFixed(1).padStart(5)}  ceiling ${ceiling / KB}  (${counted.length} files; with lazy and prefetched chunks ${(all / KB).toFixed(1)} kB)`,
    );

    if (def.name !== "engineering-h3")
      for (const s of counted)
        expect(bodies.get(s.url) ?? "", `${s.url} carries a heavy library`).not.toMatch(HEAVY);

    const limit = STRICT ? target : ceiling;
    expect(bytes, `${def.name}: ${(bytes / KB).toFixed(1)} kB against ${limit / KB} kB`).toBeLessThanOrEqual(
      limit,
    );
    await ctx.close();
  });
}
