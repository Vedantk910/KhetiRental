// M7: Settings, Help, How we price, Terms, Privacy, How we built it (D-16), 404, and the old URLs.
import { expect, test, type Browser, type Page } from "@playwright/test";
import { devCode, freshPhone, newVisitor, requestCode, sql, typeCode, watchHealth } from "./auth-helpers";
import { expectNoAxeViolations, hasHScroll, setTheme } from "./helpers";
import { MESSAGES } from "./messages";

const LOCALES = ["mr", "hi", "en"] as const;
const SHOTS = process.env.M7_SHOTS;

async function checkLayout(page: Page, label: string, full: boolean) {
  const combos = full
    ? ([
        [390, "light"],
        [390, "dark"],
        [1440, "light"],
        [1440, "dark"],
      ] as const)
    : ([[390, "light"]] as const);
  for (const [w, theme] of combos) {
    await page.setViewportSize({ width: w, height: 900 });
    await setTheme(page, theme);
    await expectNoAxeViolations(page, `${label} ${w} ${theme}`);
    expect(await hasHScroll(page), `${label} at ${w}`).toBe(false);
  }
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await hasHScroll(page), `${label} at 320`).toBe(false);
  await page.setViewportSize({ width: 390, height: 844 });
  await setTheme(page, "light");
}

async function shoot(page: Page, name: string) {
  if (!SHOTS) return;
  for (const [w, h, theme] of [
    [390, 844, "light"],
    [1440, 900, "light"],
    [390, 844, "dark"],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await setTheme(page, theme);
    await page.screenshot({ path: `${SHOTS}/${name}-${w}-${theme}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await setTheme(page, "light");
}

async function signUp(browser: Browser, name: string, role: "owner" | "renter") {
  const v = await newVisitor(browser);
  v.page.setDefaultTimeout(10_000);
  const phone = freshPhone();
  await requestCode(v.page, phone, { signup: { name, role } });
  await typeCode(v.page, await devCode(v.page));
  await v.page.getByRole("button", { name: "Verify" }).click();
  await expect(v.page).toHaveURL(role === "owner" ? /\/owner/ : /\/rent$/);
  return { ...v, phone: `+91${phone}` };
}

const STATIC = ["help", "how-we-price", "terms", "privacy"] as const;
const ENGINEERING = ["", "/systems", "/product", "/architecture", "/h3-spatial", "/escrow", "/pricing"];

for (const locale of LOCALES) {
  const full = locale === "en";
  test(`public pages in ${locale}: h1, axe, no sideways scroll`, async ({ page }) => {
    const m = MESSAGES[locale];
    const health = watchHealth(page);
    const titles: Record<(typeof STATIC)[number], string> = {
      help: m.help.title,
      "how-we-price": m.price.title,
      terms: m.legal.terms.title,
      privacy: m.legal.privacy.title,
    };
    for (const p of STATIC) {
      await page.goto(`/${locale}/${p}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(titles[p]);
      await checkLayout(page, `${p} ${locale}`, full);
      if (full) await shoot(page, p);
    }
    for (const p of ["terms", "privacy"]) {
      await page.goto(`/${locale}/${p}`);
      await expect(page.locator("main")).toContainText("[LEGAL REVIEW NEEDED]");
    }
    expect(health).toEqual([]);
  });

  test(`404 in ${locale}`, async ({ page }) => {
    const res = await page.goto(`/${locale}/no-such-page`);
    expect(res!.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(MESSAGES[locale].errors.notFound);
    await expect(page.getByRole("link", { name: MESSAGES[locale].bookings.findOne })).toBeVisible();
    await checkLayout(page, `404 ${locale}`, full);
    if (full) await shoot(page, "404");
  });
}

test("How we price states the real rules and has the #sources anchor", async ({ page }) => {
  await page.goto("/en/how-we-price#sources");
  const main = page.locator("main");
  await expect(main).toContainText("13.5%");
  await expect(main).toContainText("never added to your bill");
  await expect(main).toContainText("25% of the rent");
  await expect(main).toContainText("15% of the rent");
  // The worked example is the real quote(): 4 h x Rs 700 = Rs 2,800; deposit min(Rs 3,200, 25%) = Rs 700.
  await expect(page.getByText("₹2,800").first()).toBeVisible();
  await expect(page.locator("#sources")).toBeInViewport();
  await page.goto("/en");
  await page.locator('a[href$="/how-we-price#sources"]').first().click();
  await expect(page).toHaveURL(/\/en\/how-we-price#sources$/);
});

test("Help: contact placeholders are text, not dead links; FAQ opens; footer and tab links work", async ({
  browser,
  page,
}) => {
  await page.goto("/en/help");
  await expect(page.locator('main a[href^="tel:"], main a[href*="wa.me"]')).toHaveCount(0);
  await expect(page.getByText("[YOUR HELPLINE]").first()).toBeVisible();
  const q = page.getByText("How do I cancel?");
  await q.click();
  await expect(page.getByText("free until 24 hours before the start time")).toBeVisible();
  for (const [name, path] of [
    ["How we price", "/en/how-we-price"],
    ["How we built it", "/en/about/engineering"],
    ["Help", "/en/help"],
    ["Terms", "/en/terms"],
    ["Privacy", "/en/privacy"],
  ] as const) {
    const href = await page
      .getByRole("navigation", { name: "Site links" })
      .getByRole("link", { name })
      .getAttribute("href");
    expect(href).toBe(path);
    expect((await page.request.get(path)).status()).toBe(200);
  }
  const u = await signUp(browser, "Kisan Help", "renter");
  await u.page.getByRole("link", { name: "Help" }).last().click();
  await expect(u.page).toHaveURL(/\/en\/help$/);
  await expect(u.page.getByRole("heading", { level: 1, name: "Help" })).toBeVisible();
  await u.ctx.close();
});

test.describe("How we built it (D-16)", () => {
  test("every page renders, has no resume, interview, team or person wording, and links resolve", async ({
    page,
    request,
  }) => {
    const health = watchHealth(page);
    for (const sub of ENGINEERING) {
      const path = `/en/about/engineering${sub}`;
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator("body")).not.toContainText(
        /resume|interview defence|track[- ][ab]|lead \d|tarun|vedant|claude|anthropic/i,
      );
      expect(new URL(page.url()).pathname).not.toMatch(/track|tarun|vedant/i);
      const hrefs = await page
        .locator('main a[href^="/"]')
        .evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")!))]);
      for (const href of hrefs) expect((await request.get(href)).status(), href).toBe(200);
      await checkLayout(page, path, sub === "" || sub === "/systems");
      if (sub === "") await shoot(page, "engineering");
      if (sub === "/systems") await shoot(page, "engineering-systems");
    }
    expect(health).toEqual([]);
  });

  test("systems latency chart draws one bar per run", async ({ page }) => {
    await page.goto("/en/about/engineering/systems");
    await expect(page.locator("[data-bar]")).toHaveCount(4);
  });

  test("old URLs redirect with 308 to the new ones, in every locale and without a prefix", async ({
    request,
  }) => {
    const MOVED: Record<string, string> = {
      "/dossier/old-systems": "/about/engineering/systems",
      "/dossier/old-product": "/about/engineering/product",
      "/architecture": "/about/engineering/architecture",
      "/architecture/h3-spatial": "/about/engineering/h3-spatial",
      "/escrow": "/about/engineering/escrow",
      "/pricing": "/about/engineering/pricing",
      "/marketplace": "/rent",
      "/marketplace/search": "/rent",
      "/marketplace/listing": "/owner/machines/new",
    };
    for (const [from, to] of Object.entries(MOVED)) {
      for (const prefix of ["/en", "/hi", "/mr"]) {
        const res = await request.get(`${prefix}${from}`, { maxRedirects: 0 });
        expect(res.status(), `${prefix}${from}`).toBe(308);
        expect(new URL(res.headers().location, "http://x").pathname).toBe(`${prefix}${to}`);
      }
      const bare = await request.get(from, { maxRedirects: 0 });
      expect(bare.status(), from).toBe(308);
      expect(new URL(bare.headers().location, "http://x").pathname).toBe(to);
    }
    const end = await request.get("/en/dossier/old-systems");
    expect(end.url()).toMatch(/\/en\/about\/engineering\/systems$/);
    expect(end.status()).toBe(200);
  });

  test("redirect path tricks never leave the site", async ({ request }) => {
    const TRICKS = [
      "//evil.example/dossier/old-systems",
      "/en//evil.example",
      "/en/dossier//evil.example",
      "/en/dossier/old-systems/..//evil.example",
      "/en/dossier/old-systems%2F..%2F%2Fevil.example",
      "/en/dossier/old-systems?next=https://evil.example",
      "/\\evil.example/escrow",
      "/en/escrow%0d%0aLocation:%20https://evil.example",
      "/xx/escrow",
      "/en/marketplace/https://evil.example",
    ];
    for (const t of TRICKS) {
      const res = await request.get(t, { maxRedirects: 0 }).catch(() => null);
      if (!res) continue;
      const loc = res.headers().location;
      if (loc) {
        const u = new URL(loc, "http://site.test");
        expect(u.host, `${t} -> ${loc}`).toBe("site.test");
        expect(loc.startsWith("//"), `${t} -> ${loc}`).toBe(false);
      }
      expect(res.status(), t).toBeLessThan(500);
    }
  });

  test("5 parallel keyboard users tab through the pages with focus always visible", async ({ browser }) => {
    await Promise.all(
      Array.from({ length: 5 }, async (_, u) => {
        const ctx = await browser.newContext({
          viewport: u % 2 ? { width: 375, height: 812 } : { width: 1440, height: 900 },
        });
        const page = await ctx.newPage();
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        for (const sub of ["/systems", "/product", "/architecture"]) {
          await page.goto(`/en/about/engineering${sub}`);
          for (let i = 0; i < 20; i++) {
            await page.keyboard.press("Tab");
            const visible = await page.evaluate(() => {
              const el = document.activeElement as HTMLElement | null;
              if (!el || el === document.body) return true;
              const s = getComputedStyle(el);
              return s.outlineStyle !== "none" || s.boxShadow !== "none";
            });
            expect(visible, `${sub} tab ${i}`).toBe(true);
          }
        }
        expect(errors).toEqual([]);
        await ctx.close();
      }),
    );
  });
});

test.describe("Settings", () => {
  test("logged out: the page sends you to log in and every API says 401", async ({ page, request }) => {
    await page.goto("/en/settings");
    await expect(page).toHaveURL(/\/en\/login\?next=%2Fen%2Fsettings/);
    for (const [method, url, data] of [
      ["delete", "/api/me", { confirm: "DELETE" }],
      ["patch", "/api/me", { name: "Anyone" }],
      ["put", "/api/me/roles", { renter: true, owner: true }],
      ["post", "/api/me/phone", { phone: "9876543210", code: "123456" }],
    ] as const) {
      const res = await request[method](url, { data });
      expect(res.status(), `${method} ${url}`).toBe(401);
    }
  });

  for (const locale of LOCALES) {
    test(`settings page in ${locale}`, async ({ browser }) => {
      const m = MESSAGES[locale];
      const u = await signUp(browser, "Kisan Settings", "renter");
      const health = watchHealth(u.ctx);
      await u.page.goto(`/${locale}/settings`);
      await expect(u.page.getByRole("heading", { level: 1 })).toHaveText(m.settings.title);
      await expect(u.page.getByText(u.phone)).toBeVisible();
      await checkLayout(u.page, `settings ${locale}`, locale === "en");
      if (locale === "en") await shoot(u.page, "settings");
      expect(health).toEqual([]);
      await u.ctx.close();
    });
  }

  test("rename, hostile name, theme, roles, logout", async ({ browser }) => {
    const u = await signUp(browser, "Kisan Naam", "renter");
    const p = u.page;
    await p.goto("/en/settings");
    await p.getByLabel("Name").fill("<img src=x onerror=alert(1)>");
    const dialogs: string[] = [];
    p.on("dialog", (d) => {
      dialogs.push(d.message());
      void d.dismiss();
    });
    await p.getByRole("button", { name: "Save" }).click();
    await expect(p.getByText("Saved.")).toBeVisible();
    await p.reload();
    await expect(p.getByLabel("Name")).toHaveValue("<img src=x onerror=alert(1)>");
    expect(await p.locator("main img").count()).toBe(0);
    expect(dialogs).toEqual([]);
    await p.getByLabel("Name").fill("x");
    await p.getByRole("button", { name: "Save" }).click();
    await expect(p.getByRole("alert")).toBeVisible();

    await p.getByRole("radio", { name: "Dark" }).click();
    await expect(p.locator("html")).toHaveAttribute("data-theme", "dark");
    await p.reload();
    await expect(p.locator("html")).toHaveAttribute("data-theme", "dark");
    await p.getByRole("radio", { name: "Same as phone" }).click();
    await expect(p.locator("html")).not.toHaveAttribute("data-theme", /.+/);

    // Roles: turn owner on, the Owner tab appears, the last role can't be turned off.
    await p.getByRole("switch", { name: "I list machines" }).click();
    await expect(p.getByRole("switch", { name: "I list machines" })).toBeChecked();
    await expect(p.getByRole("link", { name: "Add a machine" })).toBeVisible();
    await expect(p.getByRole("link", { name: "Owner" }).first()).toBeVisible();
    await p.getByRole("switch", { name: "I rent machines" }).click();
    await expect(p.getByRole("switch", { name: "I rent machines" })).not.toBeChecked();
    await p.getByRole("switch", { name: "I list machines" }).click();
    await expect(p.getByText("Keep at least one on.")).toBeVisible();

    await p.getByRole("button", { name: "Log out" }).click();
    await expect(p).toHaveURL(/\/en$/);
    await p.goto("/en/settings");
    await expect(p).toHaveURL(/\/login/);
    await u.ctx.close();
  });

  test("change number with a code; someone else's number is refused", async ({ browser }) => {
    const a = await signUp(browser, "Kisan Phone", "renter");
    const b = await signUp(browser, "Kisan Other", "renter");
    const p = a.page;
    await p.goto("/en/settings");
    await p.getByRole("button", { name: "Change number" }).click();
    const fresh = freshPhone();
    await p.getByLabel("New mobile number").fill(fresh);
    await p.getByRole("button", { name: "Send code" }).click();
    const code = await devCode(p);
    await p.getByLabel("6-digit code").fill("000000".replace("0", code === "000000" ? "1" : "0"));
    await p.getByRole("button", { name: "Verify and change" }).click();
    await expect(p.getByRole("alert")).toBeVisible();
    await p.getByLabel("6-digit code").fill(code);
    await p.getByRole("button", { name: "Verify and change" }).click();
    await expect(p.getByText(`+91${fresh}`)).toBeVisible();
    // Taking B's number
    await expect(p.getByText(/Dev only/)).toHaveCount(0); // the first code's toast must be gone
    await p.getByRole("button", { name: "Change number" }).click();
    await p.getByLabel("New mobile number").fill(b.phone.slice(3));
    await p.getByRole("button", { name: "Send code" }).click();
    await p.getByLabel("6-digit code").fill(await devCode(p));
    await p.getByRole("button", { name: "Verify and change" }).click();
    await expect(p.getByText("This number already has an account.")).toBeVisible();
    const rows = await sql((s) => s`SELECT phone FROM users WHERE phone = ${b.phone}`);
    expect(rows).toHaveLength(1);
    await a.ctx.close();
    await b.ctx.close();
  });

  test("delete my account: needs DELETE, refused with a live booking, then anonymises and ends the session", async ({
    browser,
  }) => {
    test.setTimeout(60_000);
    const u = await signUp(browser, "Kisan Mitao", "renter");
    const other = await signUp(browser, "Kisan Bachao", "renter");
    const p = u.page;
    const me = await sql(
      async (s) => (await s`SELECT id FROM users WHERE phone = ${u.phone}`)[0].id as string,
    );
    // A live booking on someone else's machine.
    const bookingId = await sql(async (s) => {
      const [o] = await s<{ id: string }[]>`INSERT INTO users (name, email, roles)
        VALUES ('Owner Z', ${`z.${Date.now()}@example.test`}, ARRAY['owner']) RETURNING id`;
      const [m] = await s<
        { id: string }[]
      >`INSERT INTO machines (owner_id, category, make, model, hp, year, attachments, location, village, pin,
          price_unit, price_paise, active, rc_status)
        VALUES (${o.id}, 'tractor', 'Kubota', 'X', 55, 2020, ARRAY['plough'],
          ST_SetSRID(ST_MakePoint(76.56, 18.40), 4326)::geography, 'Latur', '413512', 'hour', 70000, true, 'checked') RETURNING id`;
      const code = `KR-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      const [b] = await s<
        { id: string }[]
      >`INSERT INTO bookings (code, machine_id, renter_id, during, start_date, end_date, slot,
          est_qty, unit, rate_paise, rent_paise, deposit_paise, diesel_included, total_paise, reply_by, idempotency_key)
        VALUES (${code}, ${m.id}, ${me}, tstzrange(now() + interval '30 days', now() + interval '30 days 6 hours', '[)'),
          (now() + interval '30 days')::date, (now() + interval '30 days')::date, 'morning', 4, 'hour', 70000, 280000, 70000, true,
          280000, now() + interval '2 hours', ${crypto.randomUUID()}) RETURNING id`;
      return b.id;
    });
    await p.goto("/en/settings");
    await p.getByRole("button", { name: "Delete my account" }).click();
    const dialog = p.getByRole("dialog");
    const go = dialog.getByRole("button", { name: "Delete my account" });
    await expect(go).toHaveAttribute("aria-disabled", "true");
    await dialog.getByLabel("Type DELETE to confirm").fill("delete");
    await expect(go).toHaveAttribute("aria-disabled", "true");
    await dialog.getByLabel("Type DELETE to confirm").fill("DELETE");
    await go.click();
    await expect(dialog.getByRole("alert")).toContainText("You have bookings in progress");
    await dialog.getByRole("button", { name: "Keep my account" }).click();
    await p.reload();
    await expect(p.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();

    await sql((s) => s`UPDATE bookings SET status = 'CANCELLED' WHERE id = ${bookingId}`);
    await p.getByRole("button", { name: "Delete my account" }).click();
    await p.getByRole("dialog").getByLabel("Type DELETE to confirm").fill("DELETE");
    await p.getByRole("dialog").getByRole("button", { name: "Delete my account" }).click();
    await expect(p.getByText("Your account is deleted.")).toBeVisible();

    const row = await sql(async (s) => (await s`SELECT * FROM users WHERE id = ${me}`)[0]);
    expect([row.name, row.phone, row.email, row.password_hash]).toEqual([null, null, null, null]);
    expect(row.deleted_at).not.toBeNull();
    // Session reuse: the old cookie is dead, in the browser and over the API.
    expect((await p.request.get("/api/me")).status()).toBe(401);
    expect((await p.request.delete("/api/me", { data: { confirm: "DELETE" } })).status()).toBe(401);
    await p.goto("/en/settings");
    await expect(p).toHaveURL(/\/login/);
    // The other person is untouched.
    expect((await other.page.request.get("/api/me")).status()).toBe(200);
    // The number can sign up again as someone new.
    const again = await newVisitor(browser);
    await requestCode(again.page, u.phone.slice(3), { signup: { name: "Naya Kisan", role: "renter" } });
    await typeCode(again.page, await devCode(again.page));
    await again.page.getByRole("button", { name: "Verify" }).click();
    await expect(again.page).toHaveURL(/\/en\/rent$/);
    const ids = await sql((s) => s`SELECT id FROM users WHERE phone = ${u.phone}`);
    expect(ids).toHaveLength(1);
    expect(ids[0].id).not.toBe(me);
    await u.ctx.close();
    await other.ctx.close();
    await again.ctx.close();
  });
});
