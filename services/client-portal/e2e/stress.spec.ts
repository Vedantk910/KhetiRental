import { type Page, expect, test } from "@playwright/test";

const USERS = 5;

async function menuConsistent(page: Page) {
  const btn = page.getByRole("button", { name: /menu/i });
  if (!(await btn.isVisible())) return;
  const expanded = (await btn.getAttribute("aria-expanded")) === "true";
  const visible = await page.locator("#mobile-menu").isVisible();
  expect(expanded).toBe(visible);
}

const noHScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("5 parallel users hammer the shell", async ({ browser }) => {
  const contexts = await Promise.all(Array.from({ length: USERS }, () => browser.newContext({ viewport: { width: 375, height: 812 } })));
  await Promise.all(
    contexts.map(async (ctx) => {
      const page = await ctx.newPage();
      const errors: string[] = [];
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("/");
      const btn = page.getByRole("button", { name: /menu/i });

      // rapid toggling
      for (let i = 0; i < 20; i++) {
        await btn.click();
        await menuConsistent(page);
      }
      expect(await noHScroll(page)).toBe(true);

      // resize back and forth
      for (let i = 0; i < 4; i++) {
        await page.setViewportSize({ width: 1280, height: 800 });
        await menuConsistent(page);
        await expect(page.locator('nav a[href="/pricing"]:visible').first()).toBeVisible();
        await page.setViewportSize({ width: 375, height: 812 });
        await menuConsistent(page);
        expect(await noHScroll(page)).toBe(true);
      }

      // keyboard only: Tab to the button, Enter opens, Escape closes and refocuses it
      await page.reload();
      await page.keyboard.press("Tab");
      for (let i = 0; i < 10; i++) {
        if (await btn.evaluate((el) => el === document.activeElement)) break;
        await page.keyboard.press("Tab");
      }
      await expect(btn).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(btn).toHaveAttribute("aria-expanded", "true");
      await menuConsistent(page);
      await page.keyboard.press("Tab");
      await expect(page.locator("#mobile-menu a:focus")).toHaveCount(1);
      await page.keyboard.press("Escape");
      await expect(btn).toHaveAttribute("aria-expanded", "false");
      await expect(page.locator("#mobile-menu")).toBeHidden();
      await expect(btn).toBeFocused();
      await menuConsistent(page);

      expect(errors).toEqual([]);
      await ctx.close();
    }),
  );
});
