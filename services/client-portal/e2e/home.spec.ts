import { expect, test } from "@playwright/test";

const HREFS = [
  "/marketplace",
  "/architecture/h3-spatial",
  "/pricing",
  "/escrow",
  "/architecture",
  "/dossier/track-b-product",
  "/dossier/track-a-systems",
];

test("home loads with navbar and all nav links, no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "KhetiRental v2.0" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(page.getByText("Demo mode")).toBeVisible();
  for (const href of HREFS) {
    await expect(page.locator(`nav a[href="${href}"]`).first()).toBeAttached();
  }
  expect(errors).toEqual([]);
});

test("mobile: menu button reveals links, no horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const btn = page.getByRole("button", { name: /menu/i });
  await expect(btn).toBeVisible();
  await expect(page.getByRole("link", { name: "Pricing Engine" })).toBeHidden();
  await btn.click();
  await expect(btn).toHaveAttribute("aria-expanded", "true");
  for (const href of HREFS) {
    await expect(page.locator(`nav a[href="${href}"]:visible`).first()).toBeVisible();
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

for (const width of [1024, 1280, 1440]) {
  test(`no horizontal scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    for (const path of ["/", "/pricing", "/escrow"]) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), path).toBe(true);
    }
  });
}
