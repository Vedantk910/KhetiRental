// A second `next start` that behaves like a real deployment: no mock sign-in, no logged codes, no SMS
// provider, no SMTP. Proves what a visitor can still do there: sign up and log in with email, reset by link
// without learning who has an account, and no dead-end Mobile method.
import { expect, test } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { E2E_AUTH_SECRET, E2E_DATABASE_URL } from "./db";
import { freshEmail, freshIp, newVisitor, sql, watchHealth } from "./auth-helpers";
import { expectNoAxeViolations, setTheme, untilInteractive } from "./helpers";

const PORT = 3218;
const BASE = `http://localhost:${PORT}`;
let server: ChildProcess;

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  const env = { ...process.env };
  delete env.ENABLE_MOCK_AUTH;
  delete env.ENABLE_DEV_UI;
  server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    env: {
      ...env,
      NODE_ENV: "production",
      DATABASE_URL: E2E_DATABASE_URL,
      AUTH_SECRET: E2E_AUTH_SECRET,
      SITE_URL: BASE,
    },
    stdio: "ignore",
  });
  await expect
    .poll(
      () =>
        fetch(`${BASE}/en`).then(
          (r) => r.status,
          () => 0,
        ),
      { timeout: 60_000 },
    )
    .toBe(200);
});
test.afterAll(() => {
  server.kill();
});

test("login offers email only, with no Mobile method and no mock Google", async ({ browser }) => {
  const { ctx, page } = await newVisitor(browser);
  await page.goto(`${BASE}/en/login`);
  await untilInteractive(page.getByRole("tab", { name: "Log in" }));
  await expect(page.getByRole("radio", { name: "Mobile number" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
  await expect(page.getByLabel("Email address")).toBeVisible();
  await page.getByRole("tab", { name: "Sign up" }).click();
  await expect(page.getByRole("radio", { name: "Mobile number" })).toHaveCount(0);
  for (const theme of ["light", "dark"] as const) {
    await setTheme(page, theme);
    await expectNoAxeViolations(page, `deployed login ${theme}`);
  }
  const res = await page.request.post(`${BASE}/api/auth/otp`, { data: { phone: "+919876512345" } });
  expect(res.status()).toBe(503);
  expect(await res.json()).toMatchObject({ code: "phone_login_unavailable" });
  await ctx.close();
});

test("email sign-up, log out, log in: one users row with name, email and role", async ({ browser }) => {
  const { ctx, page } = await newVisitor(browser);
  const health = watchHealth(ctx);
  const email = freshEmail("deploy");
  await page.goto(`${BASE}/en/login?mode=signup`);
  await untilInteractive(page.getByRole("tab", { name: "Log in" }));
  await page.getByLabel("Full name").fill("Deploy Check");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("long-enough-1");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/en\/rent$/);
  await page.goto(`${BASE}/en/settings`);
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/en$/);
  await page.goto(`${BASE}/en/login`);
  await untilInteractive(page.getByRole("tab", { name: "Log in" }));
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("long-enough-1");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/en\/rent$/);
  const rows = await sql((s) => s`SELECT name, email, roles FROM users WHERE email = ${email}`);
  expect(rows).toEqual([{ name: "Deploy Check", email, roles: ["renter"] }]);
  expect(health).toEqual([]);
  await ctx.close();
});

test("forgot-password answers the same for known and unknown emails and shows no link", async ({
  request,
}) => {
  const known = freshEmail("known");
  const r = await request.post(`${BASE}/api/auth/signup`, {
    data: { name: "Known", email: known, password: "long-enough-1", roles: ["renter"] },
    headers: { "x-forwarded-for": freshIp() },
  });
  expect(r.status()).toBe(201);
  const ask = async (email: string) => {
    const res = await request.post(`${BASE}/api/auth/forgot`, {
      data: { email },
      headers: { "x-forwarded-for": freshIp(), host: "evil.example", "x-forwarded-host": "evil.example" },
    });
    return { status: res.status(), body: await res.json() };
  };
  const a = await ask(known);
  const b = await ask(freshEmail("ghost"));
  expect(a).toEqual({ status: 200, body: { ok: true } });
  expect(b).toEqual(a);
});
