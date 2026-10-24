import { expect, test } from "@playwright/test";

test("pricing calculator recomputes and never shows NaN", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("/en/pricing");
  const rate = page.getByTestId("hourly-rate");
  await expect(rate).toHaveText("₹1,053.00"); // M-101 in showcase/analytics/results/pricing_report.json
  await expect(page.getByTestId("payback")).toContainText("4.30 yr");
  await page.getByLabel(/soil type/i).selectOption("black_cotton");
  await expect(rate).not.toHaveText("₹1,053.00");
  await page.getByLabel(/diesel price/i).fill("-5");
  await expect(page.getByRole("alert").filter({ hasText: /check the inputs/i })).toBeVisible();
  await page.getByLabel(/diesel price/i).fill("91");
  await expect(page.locator("body")).not.toContainText(/NaN|Infinity/);
  await expect(page.locator(".recharts-bar-rectangle")).toHaveCount(2);
  expect(errors).toEqual([]);
});
