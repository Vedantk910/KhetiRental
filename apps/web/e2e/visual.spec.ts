// Visual snapshots of the key pages at 390 / 768 / 1280 (REVIEW M8). Welcome is shot in reduced-motion ("none") so the
// scene and counters are still. Anything that depends on today's date, a timer or a booking code is masked.
//   npm run test:visual           compare against the committed baselines
//   npm run test:visual:update    rewrite them (do this after an intended visual change, then look at the diff)
// Baselines are per operating system (Playwright adds -darwin / -linux to each file name); on a system with no
// committed baselines the spec is skipped instead of failing, and `test:visual:update` creates them.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { existsSync, readdirSync } from "node:fs";
import { sql } from "./auth-helpers";
import { contextFor, loadIds, type Area, type Ids } from "./pages";

const SIZES = [
  { w: 390, h: 844 },
  { w: 768, h: 1024 },
  { w: 1280, h: 800 },
] as const;
const FAR = "from=2030-01-10&to=2030-01-11&slot=full"; // far enough out that no seeded booking touches it

const dir = new URL("./visual.spec.ts-snapshots/", import.meta.url);
const haveBaselines = existsSync(dir) && readdirSync(dir).some((f) => f.endsWith(`-${process.platform}.png`));
test.skip(!haveBaselines && !process.env.UPDATE_VISUAL, `no ${process.platform} baselines committed yet`);

let ids: Ids;
let detailId: string;
test.beforeAll(async () => {
  ids = await loadIds();
  // The same machine every run, whatever ids the seed handed out.
  detailId = (
    await sql(
      (s) =>
        s<
          { id: string }[]
        >`SELECT id FROM machines WHERE is_sample AND active AND rc_status = 'checked' ORDER BY make, model, village, id LIMIT 1`,
    )
  )[0].id;
});

interface Shot {
  name: string;
  area: Area;
  path: (i: Ids) => string;
  full?: boolean;
  mask?: (p: Page) => Locator[];
}

const SHOTS: Shot[] = [
  { name: "welcome", area: "public", path: () => "/en" },
  { name: "login", area: "public", path: () => "/en/login", full: true },
  { name: "rent", area: "renter", path: () => "/en/rent", full: true },
  {
    name: "results",
    area: "renter",
    path: () => `/en/rent/results?job=plough&place=302029&${FAR}&r=10&sort=nearest`,
    full: true,
  },
  {
    name: "detail",
    area: "renter",
    path: () => `/en/rent/m/${detailId}?job=plough&place=302029&${FAR}&r=10`,
    full: true,
    mask: (p) => [p.locator("[data-state]")], // the free-days strip starts today
  },
  {
    name: "booking-step",
    area: "renter",
    path: () => `/en/rent/m/${detailId}/book?job=plough&place=302029&${FAR}`,
  },
  {
    name: "bookings",
    area: "renter",
    path: () => "/en/bookings",
    full: true,
    mask: (p) => [p.locator("main li h2")], // each booking's dates
  },
  {
    name: "owner",
    area: "owner",
    path: () => "/en/owner",
    full: true,
    // earnings, the request list and the calendar all depend on today
    mask: (p) => [p.locator("dd"), p.locator('section[aria-labelledby="req-h"]'), p.locator("[data-date]")],
  },
  { name: "settings", area: "renter", path: () => "/en/settings", full: true },
];

test.describe.configure({ mode: "parallel" });

for (const shot of SHOTS) {
  for (const { w, h } of SIZES) {
    test(`${shot.name} at ${w}`, async ({ browser }) => {
      test.setTimeout(60_000);
      const ctx = await contextFor(browser, shot.area, { width: w, height: h });
      const page = await ctx.newPage();
      await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
      await page.route(
        (u) => !["localhost", "127.0.0.1"].includes(u.hostname),
        (r) => r.abort(), // map tiles
      );
      await page.goto(shot.path(ids));
      await expect(page.locator("h1").first()).toBeAttached();
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveScreenshot(`${shot.name}-${w}.png`, {
        fullPage: shot.full ?? false,
        mask: shot.mask?.(page) ?? [],
        animations: "disabled",
        stylePath: new URL("./visual.css", import.meta.url).pathname,
        caret: "hide",
        maxDiffPixelRatio: 0.02,
      });
      await ctx.close();
    });
  }
}
