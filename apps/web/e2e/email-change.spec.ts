// Settings → change email, through the browser. The mail mock hands the confirm link back to the page.
import { expect, test, type Page } from "@playwright/test";
import { freshEmail, signUp, sql, watchHealth } from "./auth-helpers";
import { checkLayout, untilInteractive } from "./helpers";

async function requestLink(page: Page, email: string, check = false) {
  await page.goto("/en/settings");
  const open = page.getByRole("button", { name: "Change email" });
  await untilInteractive(open);
  await open.click();
  await page.getByLabel("New email").fill(email);
  if (check) await checkLayout(page, "settings email form open", true);
  await page.getByRole("button", { name: "Send link" }).click();
  await expect(page.getByRole("status").filter({ hasText: email })).toBeVisible();
  return (await page.getByRole("status").getByRole("link").getAttribute("href"))!;
}

test("ask, open the link, confirm: the email changes and the link works once", async ({ browser }) => {
  const u = await signUp(browser, "Kisan Mail", "renter");
  const health = watchHealth(u.ctx);
  const email = freshEmail("chg");
  const link = await requestLink(u.page, email, true);
  await checkLayout(u.page, "settings email link sent", true);

  await u.page.goto(`/en${link.replace(/^\/en/, "")}`);
  await expect(u.page.getByRole("heading", { level: 1 })).toHaveText("Confirm your new email");
  await checkLayout(u.page, "email confirm", true);
  const go = u.page.getByRole("button", { name: "Confirm new email" });
  await untilInteractive(go);
  await go.click();
  await expect(u.page.getByRole("status")).toHaveText(`Your email is now ${email}.`);

  await u.page.goto("/en/settings");
  await expect(u.page.getByText(email)).toBeVisible();
  // Still signed in; the same link is spent.
  await u.page.goto(`/en${link.replace(/^\/en/, "")}`);
  const again = u.page.getByRole("button", { name: "Confirm new email" });
  await untilInteractive(again);
  await again.click();
  await expect(u.page.locator("main").getByRole("alert")).toContainText("expired");
  expect(health).toEqual([]);
  await u.ctx.close();
});

test("another signed-in person cannot use the link, and an address in use is refused", async ({
  browser,
}) => {
  const a = await signUp(browser, "Kisan Ek", "renter");
  const b = await signUp(browser, "Kisan Do", "renter");
  const taken = freshEmail("taken");
  await sql((s) => s`UPDATE users SET email = ${taken} WHERE phone = ${b.phone}`);
  const link = await requestLink(a.page, freshEmail("mine"));
  await b.page.goto(`/en${link.replace(/^\/en/, "")}`);
  const go = b.page.getByRole("button", { name: "Confirm new email" });
  await untilInteractive(go);
  await go.click();
  await expect(b.page.locator("main").getByRole("alert")).toContainText("expired");
  await a.page.goto("/en/settings");
  await a.page.getByRole("button", { name: "Change email" }).click();
  await a.page.getByLabel("New email").fill(taken);
  await a.page.getByRole("button", { name: "Send link" }).click();
  await expect(a.page.getByText("This email already has an account.")).toBeVisible();
  await a.ctx.close();
  await b.ctx.close();
});

test("logged out: the confirm page asks for a login and the APIs say 401", async ({ page, request }) => {
  await page.goto("/en/settings/email?token=abcdefghijklmnopqrstuvwx");
  await expect(page).toHaveURL(/\/en\/login\?next=/);
  expect((await request.post("/api/me/email", { data: { email: "a@b.test" } })).status()).toBe(401);
  expect(
    (await request.post("/api/me/email/confirm", { data: { token: "abcdefghijklmnopqrstuvwx" } })).status(),
  ).toBe(401);
});
