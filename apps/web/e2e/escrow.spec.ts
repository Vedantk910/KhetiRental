import { type Page, expect, test } from "@playwright/test";

const ACTIONS = [
  /authorise escrow/i,
  /complete handover/i,
  /simulate no-show/i,
  /simulate geofence breach/i,
  /simulate hour tamper/i,
  /return machine/i,
  /^settle$/i,
  /renter at fault/i,
  /owner at fault/i,
  /^reset$/i,
];

async function ledgerBalanced(page: Page) {
  await expect(page.getByTestId("ledger-check")).toContainText("Balanced");
}

test("happy path settles with a balanced ledger", async ({ page }) => {
  await page.goto("/escrow");
  await page.getByRole("button", { name: /authorise escrow/i }).click();
  await page.getByRole("button", { name: /complete handover/i }).click();
  await page.getByRole("button", { name: /return machine/i }).click();
  await page.getByRole("button", { name: /^settle$/i }).click();
  await expect(page.getByTestId("escrow-stage")).toHaveText("Settled");
  await ledgerBalanced(page);
});

test("breach freezes the deposit and blocks settlement", async ({ page }) => {
  await page.goto("/escrow");
  await page.getByRole("button", { name: /authorise escrow/i }).click();
  await page.getByRole("button", { name: /complete handover/i }).click();
  await page.getByRole("button", { name: /simulate geofence breach/i }).click();
  await expect(page.getByTestId("rule-fired")).toHaveText("D-01");
  await expect(page.getByText("Deposit frozen")).toBeVisible();
  await expect(page.getByRole("button", { name: /^settle$/i })).toBeDisabled();
});

// Multi-user adversarial run: 5 renters/owners in parallel mash random escrow
// actions (including disabled ones, forced) as fast as possible. The ledger
// must stay balanced and the page must never throw.
test("5 parallel users mashing escrow actions cannot unbalance the ledger", async ({ browser }) => {
  const contexts = await Promise.all(Array.from({ length: 5 }, () => browser.newContext()));
  await Promise.all(
    contexts.map(async (ctx, u) => {
      const page = await ctx.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      await page.goto("/escrow");
      let seed = 7 + u;
      const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
      for (let i = 0; i < 60; i++) {
        const btn = page.getByRole("button", { name: ACTIONS[Math.floor(rnd() * ACTIONS.length)] });
        if (await btn.count()) await btn.click({ force: true, timeout: 1000 }).catch(() => {});
        if (i % 10 === 0) await ledgerBalanced(page);
      }
      await ledgerBalanced(page);
      expect(errors).toEqual([]);
      await ctx.close();
    }),
  );
});
