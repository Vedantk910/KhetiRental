import { expect, test, type Page } from "@playwright/test";
import {
  expectNoAxeViolations,
  hasHScroll,
  LOCALES,
  setTheme,
  untilInteractive,
  watchErrors,
} from "./helpers";
import { newVisitor, signUp } from "./auth-helpers";

const WIDTHS = [320, 390, 768, 1024, 1440];
const FINAL = ["86%", "1.08", "47%"];
const regionName = "Key facts about Indian farms";

const overlap = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function heroBoxes(page: Page) {
  const h1 = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
  const tag = (await page.locator(".kr-hero p").first().boundingBox())!;
  const buttons = await page.locator(".kr-hero nav a").evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }),
  );
  return { h1, tag, buttons };
}

for (const locale of LOCALES) {
  for (const width of WIDTHS) {
    test(`welcome ${locale} at ${width}px: no horizontal scroll, heading, tagline and buttons never overlap`, async ({
      page,
    }) => {
      const errors = watchErrors(page);
      await page.setViewportSize({ width, height: width < 700 ? 800 : 900 });
      await page.goto(`/${locale}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await hasHScroll(page)).toBe(false);
      const { h1, tag, buttons } = await heroBoxes(page);
      expect(buttons).toHaveLength(3);
      expect(overlap(h1, tag)).toBe(false);
      for (const b of buttons) {
        expect(overlap(h1, b)).toBe(false);
        expect(overlap(tag, b)).toBe(false);
        expect(b.height).toBeGreaterThanOrEqual(47.5);
      }
      buttons.forEach((a, i) => {
        buttons.slice(i + 1).forEach((b) => {
          expect(overlap(a, b)).toBe(false);
        });
      });
      // the counters sit below the buttons
      const counters = (await page
        .getByRole("region", { name: new RegExp(".") })
        .first()
        .boundingBox())!;
      expect(counters.y).toBeGreaterThan(Math.max(...buttons.map((b) => b.y + b.height)) - 1);
      expect(errors).toEqual([]);
    });
  }
}

test("counters count up from 0 and finish on exactly 86%, 1.08 and 47%", async ({ page }) => {
  await page.goto("/en");
  const visible = page.getByRole("region", { name: regionName }).locator("[aria-hidden=true]");
  await expect(visible).toContainText(FINAL[0]);
  await expect(visible).toContainText(FINAL[1]);
  await expect(visible).toContainText(FINAL[2]);
  await expect(page.getByText("86% of farm holdings in India are small or marginal.")).toBeAttached();
  await expect(page.getByRole("link", { name: /Agriculture Census/ })).toHaveAttribute(
    "href",
    "/en/how-we-price#sources",
  );
});

test("the scene runs normally and stops when the tab is hidden", async ({ page }) => {
  await page.goto("/en", { waitUntil: "networkidle" });
  const running = () =>
    page.evaluate(
      () =>
        document.getAnimations().filter((a) => {
          const target = (a.effect as KeyframeEffect | null)?.target;
          return a.playState === "running" && !!target?.closest(".kr-scene");
        }).length,
    );
  expect(await running()).toBeGreaterThan(5);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(running).toBe(0);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(running).toBeGreaterThan(5);
});

test("reduced motion: still scene, final counter values at once, no running animation, no canvas", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en");
  const visible = page.getByRole("region", { name: regionName }).locator("[aria-hidden=true]");
  await expect(visible).toContainText("86%");
  await expect(visible).toContainText("1.08");
  await expect(visible).toContainText("47%");
  expect(
    await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length),
  ).toBe(0);
  // the tractor is parked, not at the left edge: 30 % of row 1
  const tractor = (await page.locator(".kr-drive").boundingBox())!;
  expect(tractor.x).toBeGreaterThan(40);
  expect(await page.locator("canvas").count()).toBe(0);
});

test("story sections S1–S7 are there, owner CTA and helpline link", async ({ page }) => {
  await page.goto("/en");
  const titles = await page.locator("#story h2").allTextContents();
  expect(titles).toEqual([
    "A tractor costs ₹6–7 lakh. Most of the year, it waits in the shed.",
    "You don't need to own it. You need it on time.",
    "It's already near you.",
    "The full price, before you say yes.",
    "The owner is paid after the job, not before.",
    "Your idle tractor can earn.",
    "Prefer to talk?",
  ]);
  await expect(page.locator("#how")).toBeAttached();
  await expect(page.getByRole("link", { name: "List your tractor" })).toHaveAttribute(
    "href",
    "/en/login?mode=signup&role=owner",
  );
  await expect(page.getByRole("link", { name: "Call +91 78219 00000" })).toHaveAttribute(
    "href",
    "tel:+917821900000",
  );
  await expect(page.getByRole("link", { name: "How it works ↓" })).toHaveAttribute("href", "/en#how");
  // alternating backgrounds, S6 indigo
  const bg = await page
    .locator("#story section")
    .evaluateAll((s) => s.map((e) => getComputedStyle(e).backgroundColor));
  expect(bg[5]).toBe("rgb(34, 53, 133)");
  expect(bg[0]).not.toBe(bg[1]);
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/track [ab]|lead \d|tarun|vedant|claude|anthropic/i);
});

test("story reveals are scroll-driven: content is fully visible once scrolled to", async ({ page }) => {
  await page.goto("/en");
  await page.locator("#s4").evaluate((e) => {
    e.scrollIntoView({ block: "center", behavior: "instant" });
  });
  const row = page.locator("#s4").locator("xpath=ancestor::section").locator(".kr-row").first();
  await expect
    .poll(async () => Number(await row.evaluate((e) => getComputedStyle(e).opacity)))
    .toBeGreaterThan(0.99);
});

test("logged-in visitors see Find machines and My bookings in place of Log in / Sign up", async ({
  browser,
}) => {
  const { ctx, page } = await newVisitor(browser);
  const { csrfToken } = (await (await ctx.request.get("/api/auth/csrf")).json()) as { csrfToken: string };
  await ctx.request.post("/api/auth/callback/mock-google", {
    form: { csrfToken, callbackUrl: "/en" },
    maxRedirects: 0,
  });
  await page.goto("/en");
  const nav = page.locator(".kr-hero nav");
  await expect(nav.getByRole("link")).toHaveText(["Find machines", "My bookings", "How it works ↓"]);
  await expect(nav.getByRole("link", { name: "Find machines" })).toHaveAttribute("href", "/en/rent");
  await expect(page.getByRole("link", { name: "Log in" })).toHaveCount(0);
  await ctx.close();
});

test("no heavy runtime on the welcome page: no canvas, no 3D or GSAP chunk", async ({ page }) => {
  const urls: string[] = [];
  page.on("request", (r) => urls.push(r.url()));
  await page.goto("/en");
  expect(await page.locator("canvas").count()).toBe(0);
  expect(urls.filter((u) => /three|gsap|leaflet/i.test(u))).toEqual([]);
});

for (const theme of ["light", "dark"] as const) {
  for (const locale of ["en", "hi"] as const) {
    test(`axe: welcome ${locale} ${theme} has zero violations`, async ({ page }) => {
      await page.goto(`/${locale}`);
      await setTheme(page, theme);
      await expectNoAxeViolations(page, `welcome ${locale} ${theme}`);
      await page.locator("#s6").evaluate((e) => {
        e.scrollIntoView({ block: "center", behavior: "instant" });
      });
      await page.waitForTimeout(400);
      await expectNoAxeViolations(page, `welcome ${locale} ${theme} scrolled`);
    });
  }
}

test("a signed-in renter's List your tractor goes to listing (owner mode offered), not to log-in", async ({
  browser,
}) => {
  const { ctx, page } = await signUp(browser, "Kisan Rao", "renter");
  await page.goto("/en");
  const cta = page.getByRole("link", { name: "List your tractor" });
  await expect(cta).toHaveAttribute("href", "/en/owner/machines/new");
  await untilInteractive(cta);
  await cta.click();
  await expect(page).toHaveURL(/\/en\/owner\/machines\/new/);
  await expect(page.getByRole("heading", { name: "Turn on owner mode" })).toBeVisible();
  await ctx.close();
});
