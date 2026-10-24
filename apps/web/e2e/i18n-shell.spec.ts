import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, hasHScroll, watchErrors } from "./helpers";

test.describe("first-visit locale detection", () => {
  // The browser locale drives Accept-Language (Chromium overrides a hand-set header).
  for (const [browserLocale, want] of [
    ["mr-IN", "mr"],
    ["hi-IN", "hi"],
    ["fr-FR", "en"],
    ["en-US", "en"],
  ] as const) {
    test(`browser locale ${browserLocale} → /${want}`, async ({ browser }) => {
      const ctx = await browser.newContext({ locale: browserLocale });
      const page = await ctx.newPage();
      await page.goto("/dev/ui?x=1");
      await expect(page).toHaveURL(new RegExp(`/${want}/dev/ui\\?x=1$`));
      await expect(page.locator("html")).toHaveAttribute("lang", want);
      await ctx.close();
    });
  }

  test("raw Accept-Language header is honoured by the middleware", async ({ request }) => {
    for (const [header, want] of [
      ["mr-IN,mr;q=0.9,en;q=0.8", "mr"],
      ["hi;q=0.9,en;q=0.5", "hi"],
      ["ta-IN,fr;q=0.8", "en"],
    ] as const) {
      const res = await request.get("/rent?x=1", { headers: { "Accept-Language": header }, maxRedirects: 0 });
      expect(res.status(), header).toBe(307);
      expect(res.headers().location, header).toMatch(new RegExp(`/${want}/rent\\?x=1$`));
    }
  });

  test("the NEXT_LOCALE cookie beats Accept-Language", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ locale: "mr-IN" });
    await ctx.addCookies([{ name: "NEXT_LOCALE", value: "hi", url: baseURL! }]);
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/hi$/);
    await ctx.close();
  });
});

test("language switch keeps path, query and form input, sets the cookie and lang", async ({
  page,
  context,
}) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/dev/ui?job=plough&acres=2");
  const mobile = page.getByLabel("Mobile number");
  await mobile.fill("9876543210");
  await page.getByRole("banner").getByRole("button", { name: "हिंदी" }).click();
  await expect(page).toHaveURL(/\/hi\/dev\/ui\?job=plough&acres=2$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await expect(page.getByLabel("मोबाइल नंबर")).toHaveValue("9876543210");
  await expect(page.getByRole("banner").getByRole("button", { name: "हिंदी" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const cookie = (await context.cookies()).find((c) => c.name === "NEXT_LOCALE");
  expect(cookie?.value).toBe("hi");
  expect(cookie?.expires).toBeGreaterThan(Date.now() / 1000 + 300 * 24 * 3600);
  // the footer switch too, and keyboard focus survives the switch
  const footerMr = page.getByRole("contentinfo").getByRole("button", { name: "मराठी" });
  await footerMr.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/mr\/dev\/ui\?job=plough&acres=2$/);
  await expect(page.getByRole("contentinfo").getByRole("button", { name: "मराठी" })).toBeFocused();
  expect(errors).toEqual([]);
});

test("phone header: 56 px, logo, bell, language; short labels below 400 px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/mr/dev/ui");
  const banner = page.getByRole("banner");
  expect((await banner.boundingBox())!.height).toBeCloseTo(57, 0); // 56 + 1 px border
  await expect(banner.getByRole("link", { name: "खेती रेंटल" })).toBeVisible();
  await expect(banner.getByRole("link", { name: "सूचना" })).toBeVisible();
  await expect(banner.getByRole("button", { name: "मराठी" })).toHaveText(/म/);
  await expect(banner.getByRole("navigation")).toBeHidden(); // top nav only from 1024 px
  expect(await hasHScroll(page)).toBe(false);
});

test("desktop header: top nav with Rent · My bookings · Help", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en/dev/ui");
  const nav = page.getByRole("banner").getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link")).toHaveText(["Rent", "My bookings", "Help"]);
  expect((await page.getByRole("banner").boundingBox())!.height).toBeCloseTo(65, 0);
});

test("footer links and no work-split wording anywhere in the shell", async ({ page }) => {
  await page.goto("/en/dev/ui");
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("link")).toHaveText([
    "About",
    "How we price",
    "How we built it",
    "Help",
    "Terms",
    "Privacy",
  ]);
  const shell = (await page.getByRole("banner").innerText()) + (await footer.innerText());
  expect(shell).not.toMatch(/track|lead \d|tarun|vedant/i);
});

test("skip link is first, becomes visible on focus and moves focus to main", async ({ page }) => {
  await page.goto("/en/dev/ui");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  const box = (await skip.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(48);
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.querySelector("main")!.contains(document.activeElement))).toBe(
    true,
  );
});

for (const [locale, h1, home] of [
  ["en", "We couldn't find that page.", "Go home"],
  ["mr", "ते पान सापडले नाही.", "TODO-translate: Go home"],
] as const) {
  test(`404 in ${locale}: status, title, message, actions, axe clean`, async ({ page }) => {
    const res = await page.goto(`/${locale}/no-such-page`);
    expect(res!.status()).toBe(404);
    await expect(page).toHaveTitle(locale === "en" ? "Page not found – KhetiRental" : /Page not found/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(h1);
    await expect(page.getByRole("link", { name: home })).toHaveAttribute("href", `/${locale}`);
    await expect(page.getByRole("main").getByRole("link").first()).toHaveAttribute("href", `/${locale}/rent`);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expectNoAxeViolations(page, `404 ${locale}`);
  });
}

test("security headers on pages (REVIEW S-08)", async ({ request }) => {
  const res = await request.get("/en/dev/ui");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["content-security-policy"]).toContain("object-src 'none'");
  expect(h["content-security-policy"]).not.toContain("unsafe-eval");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["permissions-policy"]).toContain("camera=()");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("CSP does not block the page: fonts load and nothing is refused", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/hi/dev/ui");
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() =>
    [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family),
  );
  expect(fonts.join(" ")).toMatch(/Mukta/);
  expect(errors.filter((e) => /Content Security Policy|Refused/i.test(e))).toEqual([]);
});

test("legacy pages still render inside the new shell", async ({ page }) => {
  for (const path of ["/en", "/en/pricing", "/en/escrow", "/en/marketplace", "/en/architecture"]) {
    const res = await page.goto(path);
    expect(res!.status(), path).toBe(200);
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});
