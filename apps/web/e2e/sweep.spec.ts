// REVIEW §0.4, enforced on every UI-SPEC §3 page in every language: no sideways scroll at 360 / 390 / 768 / 1024 / 1440,
// tap targets >= 48 px (primary buttons 56 px on phones), axe clean in light and dark, no untranslated markers,
// and a language switch that keeps the page.
import { expect, test, type Page } from "@playwright/test";
import { contextFor, loadIds, PAGES, type Ids } from "./pages";
import {
  expectNoAxeViolations,
  hasHScroll,
  LOCALES,
  setTheme,
  smallTargets,
  untilInteractive,
  watchErrors,
  WIDTHS,
} from "./helpers";

test.describe.configure({ mode: "parallel" });

let ids: Ids;
test.beforeAll(async () => {
  ids = await loadIds();
});

/** Primary action buttons (Button / ButtonLink variant "primary") shorter than 56 px. */
const shortPrimaries = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-variant="primary"]')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height < 55.5 && !el.closest("[aria-hidden=true]");
      })
      .map(
        (el) =>
          `${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 30)}" ${el.getBoundingClientRect().height.toFixed(0)}px`,
      ),
  );

for (const locale of LOCALES) {
  for (const def of PAGES) {
    test(`${def.name} in ${locale}: layout, tap targets, contrast/axe, language`, async ({ browser }) => {
      test.setTimeout(90_000);
      const ctx = await contextFor(browser, def.area);
      const page = await ctx.newPage();
      const errors = watchErrors(page);
      // Map tiles and other outside hosts stay unreachable, so the run never depends on the network.
      await page.route(
        (u) => !["localhost", "127.0.0.1"].includes(u.hostname),
        (r) => r.abort(),
      );
      const path = `/${locale}${def.path(ids)}`;
      const res = await page.goto(path);
      expect(res!.status(), path).toBeLessThan(def.name === "not-found" ? 405 : 400);
      await expect(page.locator("h1").first()).toBeAttached();
      await page.waitForLoadState("networkidle");

      // Nothing awaiting translation is ever shown.
      expect(await page.locator("body").innerText()).not.toContain("TODO-translate");
      expect(await page.content()).not.toContain("TODO-translate"); // titles, labels and the messages sent to the browser too
      await expect(page.locator("html")).toHaveAttribute("lang", locale);

      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: 900 });
        await page.waitForTimeout(350); // GSAP pin spacers re-measure ~200 ms after a resize
        expect.soft(await hasHScroll(page), `${def.name} ${locale} sideways scroll at ${w}`).toBe(false);
        expect.soft(await smallTargets(page), `${def.name} ${locale} small tap targets at ${w}`).toEqual([]);
        if (w < 768)
          expect(
            await shortPrimaries(page),
            `${def.name} ${locale} primary buttons under 56 px at ${w}`,
          ).toEqual([]);
      }

      for (const [w, theme] of [
        [390, "light"],
        [390, "dark"],
        [1440, "light"],
      ] as const) {
        await page.setViewportSize({ width: w, height: 900 });
        await setTheme(page, theme);
        await expectNoAxeViolations(page, `${def.name} ${locale} ${w} ${theme}`);
      }
      await setTheme(page, "light");

      // The language switch stays on the same page (and keeps the query).
      // (The booking step is a modal sheet over the page, so the header is not reachable there; the language is
      // chosen before it opens, and renter.spec walks the whole journey in all three.)
      if (locale === "en" && !["not-found", "book"].includes(def.name)) {
        await page.setViewportSize({ width: 1024, height: 900 });
        for (const next of ["hi", "mr"] as const) {
          const before = new URL(page.url());
          await page.locator("[data-lang-switch]:visible").first().locator(`button[lang="${next}"]`).click();
          await expect(page).toHaveURL(
            (u) => u.pathname === before.pathname.replace(/^\/\w+/, `/${next}`) && u.search === before.search,
          );
          await expect(page.locator("h1").first()).toBeAttached();
        }
      }
      expect(
        errors.filter((e) => !/Failed to load resource|net::ERR/.test(e)),
        "console errors",
      ).toEqual([]);
      await ctx.close();
    });
  }
}

test.describe("reduced motion", () => {
  for (const def of PAGES) {
    test(`${def.name}: nothing animates`, async ({ browser }) => {
      const ctx = await contextFor(browser, def.area);
      const page = await ctx.newPage();
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.route(
        (u) => !["localhost", "127.0.0.1"].includes(u.hostname),
        (r) => r.abort(),
      );
      await page.goto(`/en${def.path(ids)}`);
      await expect(page.locator("h1").first()).toBeAttached();
      await page.waitForLoadState("networkidle");
      await page.mouse.wheel(0, 3000);
      await page.waitForTimeout(400);
      const running = await page.evaluate(() =>
        document
          .getAnimations()
          .filter(
            (a) => a.playState === "running" && Number(a.effect?.getComputedTiming().activeDuration ?? 0) > 0,
          )
          .map((a) =>
            a instanceof CSSAnimation
              ? a.animationName
              : a instanceof CSSTransition
                ? a.transitionProperty
                : "?",
          ),
      );
      expect(running, def.name).toEqual([]);
      await ctx.close();
    });
  }
});

test.describe("open sheets keep the same rules", () => {
  for (const w of [360, 390, 768]) {
    test(`date picker sheet at ${w}`, async ({ browser }) => {
      const ctx = await contextFor(browser, "renter", { width: w, height: 800 });
      const page = await ctx.newPage();
      await page.goto("/en/rent");
      const open = page.getByRole("radio", { name: "Pick dates" });
      await untilInteractive(open);
      await open.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.waitForTimeout(300);
      expect(await smallTargets(page)).toEqual([]);
      expect(await hasHScroll(page)).toBe(false);
      await expectNoAxeViolations(page, `date sheet ${w}`);
      await ctx.close();
    });
  }
});
