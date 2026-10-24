import { expect, test } from "@playwright/test";

const PAGES = ["/en", "/en/architecture", "/en/dossier/track-a-systems", "/en/dossier/track-b-product"];

for (const path of PAGES) {
  test(`${path} renders cleanly and every internal link resolves`, async ({ page, request }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/track [ab]|lead \d|tarun|vedant/i);
    const hrefs = await page
      .locator('main a[href^="/"]')
      .evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")!))]);
    for (const href of hrefs) expect((await request.get(href)).status(), href).toBe(200);
    for (const width of [375, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      // Poll: ResponsiveContainer (recharts) re-measures a frame or two after the resize.
      await expect
        .poll(
          () =>
            page.evaluate(() =>
              [...document.querySelectorAll("body *")]
                .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
                .map((el) => `${el.tagName.toLowerCase()}.${(el.getAttribute("class") ?? "").slice(0, 50)}`)
                .slice(0, 5),
            ),
          { message: `${path} @${width}: elements wider than the viewport` },
        )
        .toEqual([]);
    }
    expect(errors).toEqual([]);
  });
}

test("systems latency chart draws one bar per load-test run", async ({ page }) => {
  await page.goto("/en/dossier/track-a-systems");
  await expect(page.locator(".recharts-bar-rectangle")).toHaveCount(4);
});

// 5 readers in parallel, keyboard only: Tab through every focusable element on
// each dossier; focus must always be visible and the page must never throw.
test("5 parallel keyboard users tab through the dossiers", async ({ browser }) => {
  await Promise.all(
    Array.from({ length: 5 }, async (_, u) => {
      const ctx = await browser.newContext({
        viewport: u % 2 ? { width: 375, height: 812 } : { width: 1440, height: 900 },
      });
      const page = await ctx.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      for (const path of PAGES) {
        await page.goto(path);
        for (let i = 0; i < 25; i++) {
          await page.keyboard.press("Tab");
          const visible = await page.evaluate(() => {
            const el = document.activeElement as HTMLElement | null;
            if (!el || el === document.body) return true;
            const s = getComputedStyle(el);
            return s.outlineStyle !== "none" || s.boxShadow !== "none";
          });
          expect(visible, `${path} tab ${i}`).toBe(true);
        }
      }
      expect(errors).toEqual([]);
      await ctx.close();
    }),
  );
});
