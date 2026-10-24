import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import postgres from "postgres";
import { E2E_DATABASE_URL } from "./db";

const rnd = (n: number) => Math.floor(Math.random() * n);
/** A fresh visitor address: the OTP and sign-up limits count per IP, and every test must have its own. */
export const freshIp = () => `10.${rnd(250) + 1}.${rnd(250) + 1}.${rnd(250) + 1}`;
export const freshPhone = () => `${6 + rnd(4)}${String(rnd(1e9)).padStart(9, "0")}`;
export const freshEmail = (tag = "u") => `${tag}.${Date.now()}.${rnd(1e6)}@example.test`;

export async function newVisitor(browser: Browser, opts: { locale?: string; ip?: string } = {}) {
  const ctx = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": opts.ip ?? freshIp() },
    viewport: { width: 390, height: 844 },
  });
  return { ctx, page: await ctx.newPage() };
}

/** Console errors and 5xx answers; expected 4xx (rate limits, wrong codes) log a "Failed to load resource" line that is ignored. */
export function watchHealth(ctx: BrowserContext | Page) {
  const problems: string[] = [];
  const hook = (p: Page) => {
    p.on("console", (m) => {
      if (
        m.type() === "error" &&
        !/Failed to load resource: the server responded with a status of 4\d\d/.test(m.text())
      )
        problems.push(`console: ${m.text()}`);
    });
    p.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    p.on("response", (r) => {
      if (r.status() >= 500) problems.push(`${r.status()} ${r.url()}`);
    });
  };
  if ("pages" in ctx) {
    ctx.pages().forEach(hook);
    ctx.on("page", hook);
  } else hook(ctx);
  return problems;
}

export async function sql<T>(fn: (s: postgres.Sql) => Promise<T>) {
  const s = postgres(E2E_DATABASE_URL, { max: 1 });
  try {
    return await fn(s);
  } finally {
    await s.end();
  }
}

/** The mock SMS puts the code in a dev-only toast. */
export async function devCode(page: Page): Promise<string> {
  const toast = page.getByText(/Dev only: your code is \d{6}/);
  await expect(toast.first()).toBeVisible();
  return /(\d{6})/.exec((await toast.first().textContent()) ?? "")![1];
}

export async function typeCode(page: Page, code: string) {
  await page.getByRole("textbox", { name: "Digit 1 of 6" }).click();
  await page.keyboard.type(code);
}

/** Opens /en/login in the given mode and sends a code to `phone`; leaves you on the OTP page. */
export async function requestCode(
  page: Page,
  phone: string,
  opts: { signup?: { name: string; role: "renter" | "owner" }; locale?: string; next?: string } = {},
) {
  const q = new URLSearchParams();
  if (opts.signup) q.set("mode", "signup");
  if (opts.next) q.set("next", opts.next);
  await page.goto(`/${opts.locale ?? "en"}/login${q.size ? `?${q}` : ""}`);
  if (opts.signup) {
    await page.getByLabel("Full name").fill(opts.signup.name);
    await page
      .getByRole("radio", { name: opts.signup.role === "owner" ? "List my machines" : "Rent machines" })
      .click();
  }
  await page.getByRole("radio", { name: "Mobile number" }).click(); // the chosen method is remembered
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByRole("button", { name: "Send OTP" }).click();
  await expect(page).toHaveURL(/\/login\/otp/);
}
