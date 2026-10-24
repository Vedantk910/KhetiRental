// Five visitors at once, hammering Send OTP, Verify, Log in, Resend and the language switch. Nothing may answer 500,
// log a console error or eat what was typed, and every refusal must show its copy.
import { expect, test } from "@playwright/test";
import {
  devCode,
  freshEmail,
  freshIp,
  freshPhone,
  newVisitor,
  requestCode,
  typeCode,
  watchHealth,
} from "./auth-helpers";

test.describe.configure({ mode: "parallel" });
test.setTimeout(120_000);

const USERS = [1, 2, 3, 4, 5];

for (const n of USERS) {
  test(`visitor ${n}: spamming Send OTP, Verify, Resend and the language switch`, async ({ browser }) => {
    const phone = freshPhone();
    const { ctx, page } = await newVisitor(browser);
    const health = watchHealth(ctx);
    const statuses: number[] = [];
    page.on("response", (r) => {
      if (r.url().includes("/api/auth/")) statuses.push(r.status());
    });

    await page.goto("/en/login?mode=signup");
    await page.getByLabel("Full name").fill(`Visitor ${n}`);
    await page.getByLabel("Mobile number").fill(phone);
    const send = page.getByRole("button", { name: "Send OTP" });
    // ten rapid clicks: the second and later are ignored while the first is in flight
    await Promise.all(
      Array.from({ length: 10 }, () => send.click({ force: true, noWaitAfter: true }).catch(() => undefined)),
    );
    await expect(page).toHaveURL(/\/login\/otp/);
    expect(statuses.filter((s) => s === 200).length).toBeGreaterThanOrEqual(1);

    // language switching mid-form never loses the request or the digits typed so far
    await typeCode(page, "12");
    for (const l of ["हिंदी", "मराठी", "English"]) {
      await page.getByRole("button", { name: l }).first().click();
    }
    await expect(page).toHaveURL(/\/en\/login\/otp/);
    await expect(page.getByRole("textbox", { name: "Digit 1 of 6" })).toBeVisible();
    await expect(page.getByText(/We sent a 6-digit code to \+91/)).toBeVisible();

    // resend is locked for 30 s: hammering it changes nothing
    const resend = page.getByRole("button", { name: /Resend in/ });
    for (let i = 0; i < 5; i++) await resend.click({ force: true }).catch(() => undefined);
    await expect(resend).toBeDisabled();

    // wrong codes: tries count down, then lock; never a 500
    const wrong = "000000";
    for (let i = 0; i < 7; i++) {
      await typeCode(page, wrong);
      await page.getByRole("button", { name: "Verify" }).click({ force: true });
      await expect(page.locator("#otp-error p")).toBeVisible();
    }
    await expect(page.getByText(/Too many wrong codes|code is wrong|expired/)).toBeVisible();
    expect(statuses.filter((s) => s >= 500)).toEqual([]);
    expect(health).toEqual([]);
    await ctx.close();
  });

  test(`visitor ${n}: Log in spam with email and password, then switch language`, async ({ browser }) => {
    const { ctx, page } = await newVisitor(browser);
    const health = watchHealth(ctx);
    const email = freshEmail(`adv${n}`);
    await page.goto("/en/login");
    await page.getByRole("radio", { name: "Email" }).click();
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("not-the-password");
    const login = page.getByRole("button", { name: "Log in" });
    await Promise.all(
      Array.from({ length: 8 }, () => login.click({ force: true, noWaitAfter: true }).catch(() => undefined)),
    );
    await expect(page.getByText(/Email or password is wrong|Too many tries/)).toBeVisible();
    await page.getByRole("button", { name: "हिंदी" }).first().click();
    await expect(page).toHaveURL(/\/hi\/login/);
    await expect(page.getByLabel("ईमेल पता")).toHaveValue(email);
    expect(health).toEqual([]);
    await ctx.close();
  });
}

test("shared address: a burst of Send OTP from five visitors only ever answers 200 or 429, and the page says so", async ({
  browser,
}) => {
  const ip = freshIp();
  const visitors = await Promise.all(USERS.map(() => newVisitor(browser, { ip })));
  const health = watchHealth(visitors[0].ctx);
  const results = await Promise.all(
    visitors.flatMap((v) =>
      Array.from({ length: 10 }, async () => {
        const r = await v.ctx.request.post("/api/auth/otp", { data: { phone: `+91${freshPhone()}` } });
        return {
          status: r.status(),
          retry: r.headers()["retry-after"],
          body: (await r.json()) as { code?: string },
        };
      }),
    ),
  );
  expect(results.filter((r) => ![200, 429].includes(r.status))).toEqual([]);
  const limited = results.filter((r) => r.status === 429);
  expect(limited.length).toBeGreaterThan(0);
  expect(limited.every((r) => r.body.code === "rate_limited" && Number(r.retry) > 0)).toBe(true);

  const page = visitors[1].page;
  await page.goto("/en/login");
  await page.getByLabel("Mobile number").fill(freshPhone());
  await page.getByRole("button", { name: "Send OTP" }).click();
  await expect(page.getByText("Too many tries. Wait 10 minutes and try again.")).toBeVisible();
  expect(health).toEqual([]);
  await Promise.all(visitors.map((v) => v.ctx.close()));
});

test("two visitors verifying different numbers at once never see each other's session", async ({
  browser,
}) => {
  const [a, b] = await Promise.all([newVisitor(browser), newVisitor(browser)]);
  const run = async (v: typeof a, name: string, role: "renter" | "owner") => {
    await requestCode(v.page, freshPhone(), { signup: { name, role } });
    await typeCode(v.page, await devCode(v.page));
    await v.page.getByRole("button", { name: "Verify" }).click();
    await v.page.waitForURL(role === "owner" ? /owner/ : /rent/);
    return (await (await v.ctx.request.get("/api/auth/session")).json()) as {
      user: { name: string; roles: string[] };
    };
  };
  const [sa, sb] = await Promise.all([run(a, "Alice Pawar", "renter"), run(b, "Bhima Jadhav", "owner")]);
  expect(sa.user).toMatchObject({ name: "Alice Pawar", roles: ["renter"] });
  expect(sb.user).toMatchObject({ name: "Bhima Jadhav", roles: ["owner"] });
  await Promise.all([a.ctx.close(), b.ctx.close()]);
});
