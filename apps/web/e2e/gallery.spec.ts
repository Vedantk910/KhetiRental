import { expect, test } from "@playwright/test";
import {
  expectNoAxeViolations,
  hasHScroll,
  LOCALES,
  setTheme,
  smallTargets,
  watchErrors,
  WIDTHS,
} from "./helpers";

test.describe.configure({ mode: "parallel" });

for (const locale of LOCALES) {
  for (const width of WIDTHS) {
    test(`gallery ${locale} @${width}px: axe clean light+dark, no h-scroll, 48 px targets, 18 px body`, async ({
      page,
    }) => {
      const errors = watchErrors(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${locale}/dev/ui`);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator("h1")).toHaveCount(1);

      expect(await hasHScroll(page), "horizontal scroll").toBe(false);
      expect(await smallTargets(page), "targets under 48 px").toEqual([]);
      const body = await page.evaluate(() => getComputedStyle(document.body).fontSize);
      expect(body).toBe("18px");

      for (const theme of ["light", "dark"] as const) {
        await setTheme(page, theme);
        await expectNoAxeViolations(page, `${locale} ${width} ${theme}`);
      }
      expect(errors).toEqual([]);
    });
  }

  test(`gallery ${locale}: open sheet, toasts and sticky bar are axe clean in both themes`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${locale}/dev/ui`);
    const gallery = page.getByRole("main");
    for (const b of await gallery.locator("#s-toasts ~ div button").all()) await b.click();
    await gallery.locator("section[aria-labelledby=s-sticky] button[aria-pressed]").click();
    await expect(page.locator("[data-sticky-cta]")).toBeVisible();
    await expect(page.locator("[data-tab-bar]")).toBeHidden(); // the tab bar gives way to the sticky bar
    await gallery.locator("section[aria-labelledby=s-sheet] button").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    for (const theme of ["light", "dark"] as const) {
      await setTheme(page, theme);
      await expectNoAxeViolations(page, `${locale} states ${theme}`);
    }
  });
}

test("the theme toggle flips data-theme on <html>", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/en/dev/ui");
  const toggle = page.getByRole("button", { name: "Dark theme" });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(19, 16, 13)");
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
