import { expect, test } from "@playwright/test";
import {
  devCode,
  freshEmail,
  freshIp,
  freshPhone,
  newVisitor,
  requestCode,
  sql,
  typeCode,
  watchHealth,
} from "./auth-helpers";
import { expectNoAxeViolations, hasHScroll, setTheme } from "./helpers";

const PASSWORD = "kheti-demo-2026";

test.describe("each login method works end to end and lands on the right page", () => {
  test("Continue with Google (mock) signs in the demo user → /en/rent", async ({ browser }) => {
    const { ctx, page } = await newVisitor(browser);
    const health = watchHealth(ctx);
    await page.goto("/en/login");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page).toHaveURL(/\/en\/rent$/);
    expect(health).toEqual([]);
    // signed in: login redirects away (UI-SPEC §3.1)
    await page.goto("/en/login?next=%2Fen%2Fbookings");
    await expect(page).toHaveURL(/\/en\/bookings$/);
    await ctx.close();
  });

  test("email + password: wrong password is generic; the seeded owner lands on /owner", async ({
    browser,
  }) => {
    const { ctx, page } = await newVisitor(browser);
    await page.goto("/en/login");
    await page.getByRole("radio", { name: "Email" }).click();
    await page.getByLabel("Email address").fill("ramesh@khetirental.test");
    await page.getByLabel("Password", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Email or password is wrong.")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/en\/owner$/);
    await ctx.close();
  });

  test("login honours ?next and ignores off-site targets", async ({ browser }) => {
    const { ctx, page } = await newVisitor(browser);
    await page.goto("/en/login?next=%2Fen%2Fnotifications");
    await page.getByRole("radio", { name: "Email" }).click();
    await page.getByLabel("Email address").fill("vijay@khetirental.test");
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/en\/notifications$/);
    await ctx.close();
    const b = await newVisitor(browser);
    await b.page.goto("/en/login?next=https%3A%2F%2Fevil.example");
    await b.page.getByRole("radio", { name: "Email" }).click();
    await b.page.getByLabel("Email address").fill("vijay@khetirental.test");
    await b.page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await b.page.getByRole("button", { name: "Log in" }).click();
    await expect(b.page).toHaveURL(/\/en\/owner$/);
    await b.ctx.close();
  });

  for (const [role, label, path] of [
    ["renter", "Rent machines", /\/en\/rent$/],
    ["owner", "List my machines", /\/en\/owner\/machines\/new$/],
  ] as const) {
    test(`email sign-up as ${role} → ${path}`, async ({ browser }) => {
      const { ctx, page } = await newVisitor(browser);
      await page.goto("/en/login?mode=signup");
      await page.getByRole("radio", { name: "Email" }).click();
      await page.getByLabel("Full name").fill("Asha Patil");
      await page.getByLabel("Email address").fill(freshEmail(role));
      await page.getByLabel("Password", { exact: true }).fill("a-long-password-1");
      await page.getByRole("radio", { name: label }).click();
      await page.getByRole("button", { name: "Create account" }).click();
      await expect(page).toHaveURL(path);
      await ctx.close();
    });
  }

  test("sign-up with a taken email says so, with a Log in link", async ({ browser }) => {
    const { ctx, page } = await newVisitor(browser);
    await page.goto("/en/login?mode=signup");
    await page.getByRole("radio", { name: "Email" }).click();
    await page.getByLabel("Full name").fill("Ramesh K");
    await page.getByLabel("Email address").fill("ramesh@khetirental.test");
    await page.getByLabel("Password", { exact: true }).fill("a-long-password-1");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText(/This email already has an account/)).toBeVisible();
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Log in" })).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(/mode=login/);
    await ctx.close();
  });

  for (const [role, path] of [
    ["renter", /\/en\/rent$/],
    ["owner", /\/en\/owner\/machines\/new$/],
  ] as const) {
    test(`mobile OTP sign-up as ${role}, then log in again with the same number`, async ({ browser }) => {
      const phone = freshPhone();
      const { ctx, page } = await newVisitor(browser);
      const health = watchHealth(ctx);
      await requestCode(page, phone, { signup: { name: "Kisan Rao", role } });
      await expect(
        page.getByText(`We sent a 6-digit code to +91 ${phone.slice(0, 5)} ${phone.slice(5)}.`),
      ).toBeVisible();
      await typeCode(page, await devCode(page));
      await page.getByRole("button", { name: "Verify" }).click();
      await expect(page).toHaveURL(path);
      expect(health).toEqual([]);
      await ctx.close();

      // a second visit: plain Log in with the mobile number
      const again = await newVisitor(browser);
      await requestCode(again.page, phone);
      await typeCode(again.page, await devCode(again.page));
      await again.page.getByRole("button", { name: "Verify" }).click();
      await expect(again.page).toHaveURL(role === "owner" ? /\/en\/owner$/ : /\/en\/rent$/);
      await again.ctx.close();
    });
  }

  test("a number with no account can't log in (and is told to sign up)", async ({ browser }) => {
    const { ctx, page } = await newVisitor(browser);
    await requestCode(page, freshPhone());
    await typeCode(page, await devCode(page));
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.getByText("This number has no account yet. Sign up first.")).toBeVisible();
    await ctx.close();
  });
});

test.describe("OTP page", () => {
  test("Verify stays unavailable with the reason until all 6 digits are in; paste fills the boxes", async ({
    browser,
  }) => {
    const { ctx, page } = await newVisitor(browser);
    await requestCode(page, freshPhone());
    const verify = page.getByRole("button", { name: "Verify" });
    await expect(verify).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByText("Enter all 6 digits")).toBeVisible();
    await typeCode(page, "123");
    await expect(page.getByRole("textbox", { name: "Digit 4 of 6" })).toBeFocused();
    await expect(verify).toHaveAttribute("aria-disabled", "true");
    await page.evaluate(() => navigator.clipboard.writeText("654321").catch(() => undefined));
    await page.getByRole("textbox", { name: "Digit 1 of 6" }).evaluate((el) => {
      const dt = new DataTransfer();
      dt.setData("text", "654321");
      el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    for (let i = 0; i < 6; i++)
      await expect(page.getByRole("textbox", { name: `Digit ${i + 1} of 6` })).toHaveValue("654321"[i]);
    await expect(verify).not.toHaveAttribute("aria-disabled", "true");
    await ctx.close();
  });

  test("wrong code counts down the tries, the 5th wrong code locks it, a resend unlocks", async ({
    browser,
  }) => {
    const phone = freshPhone();
    const { ctx, page } = await newVisitor(browser);
    await requestCode(page, phone, { signup: { name: "Kisan Rao", role: "renter" } });
    const real = await devCode(page);
    const wrong = real === "000000" ? "111111" : "000000";
    for (const left of [4, 3, 2, 1]) {
      await typeCode(page, wrong);
      await page.getByRole("button", { name: "Verify" }).click();
      await expect(
        page
          .getByRole("alert")
          .getByText(`That code is wrong. ${left} ${left === 1 ? "try" : "tries"} left.`),
      ).toBeVisible();
    }
    await typeCode(page, wrong);
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.getByText("Too many wrong codes. Send a new one.")).toBeVisible();
    // even the right code is refused now
    await typeCode(page, real);
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.getByText("Too many wrong codes. Send a new one.")).toBeVisible();
    await ctx.close();
  });

  test("an expired code says so", async ({ browser }) => {
    const phone = freshPhone();
    const { ctx, page } = await newVisitor(browser);
    await requestCode(page, phone, { signup: { name: "Kisan Rao", role: "renter" } });
    const code = await devCode(page);
    await sql(
      (s) => s`UPDATE otp_codes SET expires_at = now() - interval '1 minute' WHERE phone = ${"+91" + phone}`,
    );
    await typeCode(page, code);
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.getByText("This code has expired. Send a new one.")).toBeVisible();
    await ctx.close();
  });

  test("resend: 30 s countdown, then a new working code", async ({ browser }) => {
    const phone = freshPhone();
    const ctx = await browser.newContext({
      extraHTTPHeaders: { "x-forwarded-for": freshIp() },
      viewport: { width: 390, height: 844 },
    });
    const page = await ctx.newPage();
    await page.clock.install();
    await requestCode(page, phone, { signup: { name: "Kisan Rao", role: "renter" } });
    const resend = page.getByRole("button", { name: /Resend/ });
    await expect(resend).toHaveText("Resend in 0:30");
    await expect(resend).toBeDisabled();
    await page.clock.fastForward(6000);
    await expect(resend).toHaveText(/Resend in 0:2[3-5]/);
    await page.clock.fastForward(30_000);
    await sql(
      (s) => s`UPDATE otp_codes SET sent_at = now() - interval '40 seconds' WHERE phone = ${"+91" + phone}`,
    );
    await expect(resend).toHaveText("Resend code");
    await resend.click();
    await expect(page.getByText("A new code was sent.")).toBeVisible();
    await expect(resend).toBeDisabled();
    const fresh = await devCode(page);
    await typeCode(page, fresh);
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page).toHaveURL(/\/en\/rent$/);
    await ctx.close();
  });

  test("without a pending code the page goes back to login", async ({ browser }) => {
    const { ctx, page } = await newVisitor(browser);
    await page.goto("/en/login/otp");
    await expect(page).toHaveURL(/\/en\/login$/);
    await ctx.close();
  });

  test("Change number goes back with the number still typed", async ({ browser }) => {
    const phone = freshPhone();
    const { ctx, page } = await newVisitor(browser);
    await requestCode(page, phone);
    await page.getByRole("link", { name: "Change number" }).click();
    await expect(page).toHaveURL(/\/en\/login\?mode=login$/);
    await expect(page.getByLabel("Mobile number")).toHaveValue(`${phone.slice(0, 5)} ${phone.slice(5)}`);
    await ctx.close();
  });
});

test.describe("rate limits", () => {
  test("too many Send OTP requests for one number show the 10-minute copy, not an error page", async ({
    browser,
  }) => {
    const phone = freshPhone();
    const { ctx, page } = await newVisitor(browser);
    const health = watchHealth(ctx);
    for (let i = 0; i < 6; i++) await ctx.request.post("/api/auth/otp", { data: { phone: `+91${phone}` } });
    await page.goto("/en/login");
    await page.getByLabel("Mobile number").fill(phone);
    await page.getByRole("button", { name: "Send OTP" }).click();
    await expect(page.getByText("Too many tries. Wait 10 minutes and try again.")).toBeVisible();
    await expect(page).toHaveURL(/\/en\/login$/);
    expect(health).toEqual([]);
    await ctx.close();
  });

  test("too many wrong passwords for one account show the rate-limit copy", async ({ browser }) => {
    const { ctx, page } = await newVisitor(browser);
    const email = freshEmail("lock");
    await page.goto("/en/login");
    await page.getByRole("radio", { name: "Email" }).click();
    await page.getByLabel("Email address").fill(email);
    for (let i = 0; i < 6; i++) {
      await page.getByLabel("Password", { exact: true }).fill(`wrong-password-${i}`);
      await page.getByRole("button", { name: "Log in" }).click();
      await expect(page.getByRole("button", { name: "Log in" })).not.toHaveAttribute("aria-busy", "true");
    }
    await expect(page.getByText("Too many tries. Wait 10 minutes and try again.")).toBeVisible();
    await ctx.close();
  });
});

test("language switch keeps what was typed (login form and OTP page)", async ({ browser }) => {
  const phone = freshPhone();
  const { ctx, page } = await newVisitor(browser);
  await page.goto("/en/login?mode=signup");
  await page.getByLabel("Full name").fill("Asha Patil");
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByRole("radio", { name: "List my machines" }).click();
  await page.getByRole("button", { name: "हिंदी" }).click();
  await expect(page).toHaveURL(/\/hi\/login\?mode=signup$/);
  await expect(page.getByLabel("पूरा नाम")).toHaveValue("Asha Patil");
  await expect(page.getByLabel("मोबाइल नंबर")).toHaveValue(`${phone.slice(0, 5)} ${phone.slice(5)}`);
  await expect(page.getByRole("radio", { name: /TODO-translate|अपनी मशीन/ }).last()).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByRole("button", { name: "OTP भेजें" }).click();
  await expect(page).toHaveURL(/\/hi\/login\/otp/);
  await typeCode(page, "12");
  await page.getByRole("button", { name: "मराठी" }).click();
  await expect(page).toHaveURL(/\/mr\/login\/otp/);
  await expect(page.getByRole("textbox", { name: /1/ }).first()).toBeVisible();
  await expect(page.getByText(/\+91/)).toContainText(`${phone.slice(0, 5)} ${phone.slice(5)}`);
  await ctx.close();
});

test("forgot and reset password: same answer for any email, the link works once", async ({ browser }) => {
  const { ctx, page } = await newVisitor(browser);
  const email = freshEmail("reset");
  await page.goto("/en/login?mode=signup");
  await page.getByRole("radio", { name: "Email" }).click();
  await page.getByLabel("Full name").fill("Asha Patil");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("old-password-1");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/en\/rent$/);
  await ctx.clearCookies();

  // an unknown email gets the very same message and no link
  await page.goto("/en/login/forgot");
  await page.getByLabel("Email address").fill(freshEmail("nobody"));
  await page.getByRole("button", { name: "Send reset link" }).click();
  const msg = "If an account exists for this email, we've sent a link. Check your inbox.";
  await expect(page.getByText(msg)).toBeVisible();
  await expect(page.getByRole("link", { name: /reset link/ })).toHaveCount(0);

  await page.goto("/en/login/forgot");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(msg)).toBeVisible();
  const link = page.getByRole("link", { name: "Dev only: open the reset link" });
  const href = (await link.getAttribute("href"))!;
  await link.click();
  await expect(page).toHaveURL(/\/en\/login\/reset\?token=/);
  await page.getByLabel("New password", { exact: true }).fill("new-password-22");
  await page.getByLabel("Confirm new password").fill("different-22");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByText("The two passwords don't match.")).toBeVisible();
  await page.getByLabel("Confirm new password").fill("new-password-22");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page).toHaveURL(/\/en\/login$/);
  await expect(page.getByText("Password changed. Log in.")).toBeVisible();
  await page.getByRole("radio", { name: "Email" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("new-password-22");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/en\/rent$/);

  // the same link a second time is refused
  await ctx.clearCookies();
  await page.goto(href);
  await page.getByLabel("New password", { exact: true }).fill("third-password-3");
  await page.getByLabel("Confirm new password").fill("third-password-3");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByText("This link has expired. Ask for a new one.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ask for a new link" })).toBeVisible();
  await ctx.close();
});

test("validation: mobile, name, email and password messages; focus goes to the first wrong field", async ({
  browser,
}) => {
  const { ctx, page } = await newVisitor(browser);
  await page.goto("/en/login?mode=signup");
  await page.getByRole("button", { name: "Send OTP" }).click();
  await expect(page.getByText("Enter your full name (2 to 80 letters).")).toBeVisible();
  await expect(page.getByText("Enter a 10-digit mobile number.")).toBeVisible();
  await expect(page.getByLabel("Full name")).toBeFocused();
  await page.getByRole("radio", { name: "Email" }).click();
  await page.getByLabel("Full name").fill("Asha");
  await page.getByLabel("Email address").fill("nope");
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
  await ctx.close();
});

for (const theme of ["light", "dark"] as const) {
  test(`axe: login, sign-up, email, OTP, forgot and reset have zero violations (${theme})`, async ({
    browser,
  }) => {
    const { ctx, page } = await newVisitor(browser);
    for (const [label, path] of [
      ["login", "/en/login"],
      ["signup", "/en/login?mode=signup"],
      ["forgot", "/en/login/forgot"],
      ["reset", "/hi/login/reset?token=abcdefghijklmnopqrstuvwxyz"],
      ["login hi", "/hi/login"],
      ["login mr signup", "/mr/login?mode=signup"],
    ] as const) {
      await page.goto(path);
      await setTheme(page, theme);
      expect(await hasHScroll(page), label).toBe(false);
      await expectNoAxeViolations(page, `${label} ${theme}`);
    }
    await page.goto("/en/login");
    await page.getByRole("radio", { name: "Email" }).click();
    await page.getByRole("button", { name: "Log in" }).click(); // shows the inline errors
    await setTheme(page, theme);
    await expectNoAxeViolations(page, `login email errors ${theme}`);
    await requestCode(page, freshPhone());
    await setTheme(page, theme);
    await expectNoAxeViolations(page, `otp ${theme}`);
    await typeCode(page, "000000");
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.locator("#otp-error p")).toBeVisible();
    await expectNoAxeViolations(page, `otp error ${theme}`);
    await ctx.close();
  });
}

test("desktop: still field frame on the left, centred card, no heavy animation on login", async ({
  browser,
}) => {
  const { ctx, page } = await newVisitor(browser);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en/login");
  const card = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
  expect(card.x).toBeGreaterThan(720);
  expect(
    await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length),
  ).toBe(0);
  expect(await hasHScroll(page)).toBe(false);
  await ctx.close();
});
