import { type Page, expect, test } from "@playwright/test";

const NEAR = {
  candidates: [
    { id: "M-002", dist_km: 3.2, score: 0.9, hp: 45, reputation: 0.9 },
    { id: "M-003", dist_km: 5.1, score: 0.8, hp: 45, reputation: 0.95 },
    { id: "ghost-9", dist_km: 9.9, score: 0.2, hp: 60 },
  ],
  took_ms: 2,
};

async function stubNear(page: Page) {
  await page.route("**/api/machines/near**", (r) => r.fulfill({ json: NEAR }));
}

function watchErrors(page: Page) {
  const errors: string[] = [];
  // A 409 from the booking API is an expected outcome and the browser logs it as a resource error.
  page.on("console", (m) => m.type() === "error" && !/status of 409/.test(m.text()) && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function openModal(page: Page, date: string) {
  await page.goto("/marketplace/search");
  await expect(page.getByRole("button", { name: /Book John Deere 5050 D/ })).toBeVisible();
  await page.getByLabel("From", { exact: true }).fill(date);
  await page.getByRole("button", { name: /Book John Deere 5050 D/ }).click();
  const dialog = page.getByRole("dialog", { name: /Book John Deere 5050 D/ });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("farmer searches and authorises escrow", async ({ page }) => {
  const errors = watchErrors(page);
  await stubNear(page);
  const dialog = await openModal(page, "2031-01-05");
  await expect(dialog.getByText("Held in escrow")).toBeVisible();
  await dialog.getByRole("button", { name: "Authorise escrow" }).click();
  await expect(dialog.getByText(/Escrow authorised/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  expect(errors).toEqual([]);
});

test("unknown machine from the API is shown but not bookable", async ({ page }) => {
  await stubNear(page);
  await page.goto("/marketplace/search");
  const card = page.getByRole("listitem").filter({ hasText: "ghost-9" });
  await expect(card.getByText("Rate not available")).toBeVisible();
  await expect(card.getByRole("button")).toBeDisabled();
});

test("owner lists a tractor, RC name mismatch is blocked, then passes", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/marketplace/listing");
  await page.getByLabel("Make").fill("Mahindra");
  await page.getByLabel("Model").fill("275 DI");
  await page.getByLabel("Year bought or made").fill("2021");
  await page.getByLabel("Horsepower tier").selectOption("35");
  await page.getByLabel(/What you paid/).fill("390000");
  await page.getByLabel("Rotavator").check();
  await page.getByLabel("Your full name").fill("Ramesh Patil");
  await page.getByLabel("Owner name printed on the RC").fill("Someone Else");
  const pdf = { name: "doc.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") };
  await page.getByLabel("Aadhaar", { exact: true }).setInputFiles(pdf);
  await page.getByLabel(/Registration certificate/).setInputFiles(pdf);
  await expect(page.getByText("Aadhaar verified")).toBeVisible();
  await page.getByRole("button", { name: "List my tractor" }).click();
  await expect(page.getByText(/does not match your name/)).toBeVisible();
  await page.getByLabel("Owner name printed on the RC").fill("PATIL Ramesh");
  await page.getByRole("button", { name: "List my tractor" }).click();
  await expect(page.getByText(/is listed/)).toBeVisible();
  expect(errors).toEqual([]);
});

test("5 parallel farmers spam filters and Authorise: one booking each action, one winner", async ({
  browser,
}) => {
  const outcomes = await Promise.all(
    Array.from({ length: 5 }, async () => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const errors = watchErrors(page);
      let posts = 0;
      page.on("request", (r) => r.url().endsWith("/api/bookings") && r.method() === "POST" && posts++);
      await stubNear(page);
      await page.goto("/marketplace/search");
      await expect(page.getByRole("button", { name: /Book John Deere 5050 D/ })).toBeVisible();
      for (let i = 0; i < 12; i++) {
        await page.getByLabel("Village").selectOption(i % 2 ? "Jagatpura" : "Sanganer");
        await page
          .getByLabel("What do you need done")
          .selectOption(["Plowing", "Sowing", "Harvesting"][i % 3]);
      }
      await expect(page.getByRole("button", { name: /Book John Deere 5050 D/ })).toBeEnabled();
      await page.getByLabel("From", { exact: true }).fill("2031-03-10");
      await page.getByRole("button", { name: /Book John Deere 5050 D/ }).click();
      const dialog = page.getByRole("dialog", { name: /Book John Deere 5050 D/ });
      const btn = dialog.getByRole("button", { name: "Authorise escrow" });
      await btn.click({ clickCount: 3, noWaitAfter: true }).catch(() => {});
      const ok = dialog.getByText(/Escrow authorised/);
      const no = dialog.getByRole("alert").filter({ hasText: /already booked/ });
      await expect(ok.or(no)).toBeVisible();
      const won = await ok.isVisible();
      await page.waitForTimeout(300);
      expect(posts).toBe(1);
      expect(errors).toEqual([]);
      await ctx.close();
      return won;
    }),
  );
  expect(outcomes.filter(Boolean)).toHaveLength(1);
});

// No stubs: the search page against the real /api/machines/near and
// /api/bookings. Guards the seam between the matching and marketplace work.
test("real API: the default village lists bookable tractors and a booking goes through", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/marketplace/search");
  const books = page.getByRole("button", { name: /^Book / });
  await expect(books.first()).toBeEnabled();
  expect(await page.getByText("Rate not available").count()).toBe(0);
  await books.first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /authorise escrow/i }).click();
  await expect(dialog).toContainText(/booked|authorised|confirmed/i);
  expect(errors).toEqual([]);
});
