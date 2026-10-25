import { expect, test, type Browser, type Page } from "@playwright/test";
import { devCode, freshPhone, newVisitor, requestCode, sql, typeCode, watchHealth } from "./auth-helpers";
import { expectNoAxeViolations, hasHScroll, setTheme, untilInteractive } from "./helpers";
import { MESSAGES } from "./messages";
import { formatRupees } from "../lib/format";

const LOCALES = ["mr", "hi", "en"] as const;

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const png = (name = "p.png") => ({ name, mimeType: "image/png", buffer: PNG });
const inDays = (d: number) =>
  new Date(Date.now() + 5.5 * 3600_000 + d * 86_400_000).toISOString().slice(0, 10);

async function offline(page: Page) {
  await page.route(
    (u) => !["localhost", "127.0.0.1"].includes(u.hostname),
    (r) => r.abort(),
  );
}

/** Signs a fresh person up by phone (the OTP shows in the dev toast) and leaves them signed in. */
async function signUp(browser: Browser, name: string, role: "owner" | "renter") {
  const v = await newVisitor(browser);
  v.page.setDefaultTimeout(10_000);
  await offline(v.page);
  const phone = freshPhone();
  await requestCode(v.page, phone, { signup: { name, role } });
  await typeCode(v.page, await devCode(v.page));
  await v.page.getByRole("button", { name: "Verify" }).click();
  await expect(v.page).toHaveURL(role === "owner" ? /\/owner/ : /\/rent$/);
  return { ...v, phone: `+91${phone}` };
}

/** axe in light and dark at 390 and 1440, and no sideways scroll at 320 (the page must already be open). */
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

const stepButton = (page: Page) => page.locator("[data-sticky-cta] button");

for (const locale of LOCALES) {
  const m = MESSAGES[locale];
  const full = locale === "en";
  test(`owner journey in ${locale}: list, request, accept, decline, block, edit, pause, admin`, async ({
    browser,
  }) => {
    test.setTimeout(240_000);
    const model = `E${Date.now() % 1e7}${locale}`;
    const name = `Swaraj ${model}`;
    const owner = await signUp(browser, "Ramesh Patil", "owner");
    const page = owner.page;
    const health = watchHealth(owner.ctx);

    // ---- List a machine: 4 steps ---------------------------------------------------------------------------
    await page.goto(`/${locale}/owner/machines/new?step=1`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(m.list.s1);
    await page.getByLabel(m.list.company, { exact: true }).selectOption("swaraj");
    await page.getByLabel(m.list.model, { exact: true }).fill(model);
    await page.getByLabel(m.list.hp, { exact: true }).fill("48");
    await page.getByLabel(m.list.year, { exact: true }).fill("2018");
    await page.getByRole("button", { name: m.attach.rotavator }).click();
    await checkLayout(page, `step 1 ${locale}`, full);
    // nothing is skipped: a wrong HP stops the step
    await page.getByLabel(m.list.hp, { exact: true }).fill("5");
    await stepButton(page).click();
    await expect(page.getByText(m.list.hpRange)).toBeVisible();
    await page.getByLabel(m.list.hp, { exact: true }).fill("48");
    await stepButton(page).click();

    await expect(page).toHaveURL(/step=2/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(m.list.s2);
    await stepButton(page).click(); // photos are required
    await expect(page.getByText(m.list.photosNeeded)).toBeVisible();
    for (const slot of ["front", "side", "meter"])
      await page.getByTestId(`photo-${slot}-gallery`).setInputFiles(png(`${slot}.png`));
    await page.getByTestId("photo-rc-gallery").setInputFiles(png("rc.png"));
    await expect(page.getByText(m.list.rcPending)).toBeVisible();
    await checkLayout(page, `step 2 ${locale}`, full);
    await stepButton(page).click();

    await expect(page).toHaveURL(/step=3/);
    await stepButton(page).click(); // a place is required
    await expect(page.getByText(m.list.locationNeeded)).toBeVisible();
    await page.getByRole("combobox").fill("413512");
    await page.getByRole("option").first().click();
    await page.getByLabel(m.list.blockSundays).check();
    await expect(page.locator('[data-state="blocked"]').first()).toBeVisible();
    await checkLayout(page, `step 3 ${locale}`, full);
    await stepButton(page).click();

    await expect(page).toHaveURL(/step=4/);
    await page.locator("input[inputmode=numeric]").fill("0");
    await stepButton(page).click();
    await expect(page.getByText(m.list.priceRange)).toBeVisible();
    await page.locator("input[inputmode=numeric]").fill("1400");
    // the owner sees what they keep: 1,400 less 13.5 %
    await expect(page.getByText(formatRupees(121_100, locale), { exact: true })).toBeVisible();
    await checkLayout(page, `step 4 ${locale}`, full);
    await stepButton(page).click();

    await expect(page).toHaveURL(new RegExp(`/${locale}/owner$`));
    await expect(page.getByText(name).first()).toBeVisible();
    const [listed] = await sql(
      (s) => s<{ id: string; active: boolean; rc_status: string; kinds: string[] }[]>`
      SELECT m.id, m.active, m.rc_status, array_agg(p.kind ORDER BY p.kind) AS kinds
      FROM machines m JOIN machine_photos p ON p.machine_id = m.id WHERE m.model = ${model} GROUP BY m.id`,
    );
    expect(listed.active).toBe(true);
    expect(listed.rc_status).toBe("pending");
    expect(listed.kinds).toEqual(["front", "meter", "rc", "side"]);
    const sundays = await sql((s) => s`SELECT 1 FROM machine_blocks WHERE machine_id = ${listed.id}`);
    expect(sundays.length).toBeGreaterThan(5);

    // ---- A renter finds it and asks for it -----------------------------------------------------------------
    const renter = await signUp(browser, "Kisan Rao", "renter");
    const rp = renter.page;
    const ask = async (offset: number) => {
      const r = await rp.request.post("/api/bookings", {
        headers: { "idempotency-key": crypto.randomUUID() },
        data: {
          machineId: listed.id,
          startDate: inDays(offset),
          endDate: inDays(offset),
          slot: "full",
          qty: 2,
        },
      });
      expect(r.status()).toBe(201);
      return ((await r.json()) as { code: string }).code;
    };
    await rp.goto(`/${locale}/rent/results?place=413512&r=10`);
    await expect(rp.locator('a[href*="/rent/m/"]', { hasText: model }).first()).toBeVisible();
    // pick days that aren't Sundays
    let accept = 12;
    while (new Date(inDays(accept)).getUTCDay() === 0) accept++;
    let decline = accept + 1;
    while (new Date(inDays(decline)).getUTCDay() === 0) decline++;
    const code1 = await ask(accept);
    const code2 = await ask(decline);

    // ---- The owner sees the requests with their reply timers -------------------------------------------------
    await page.goto(`/${locale}/owner`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const [pre, post] = m.owner.replyIn.split("{time}");
    const timerText = (post.trim() || pre.trim()).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    await expect(page.getByText(new RegExp(timerText)).first()).toBeVisible();
    await expect(page.getByRole("button", { name: m.owner.accept })).toHaveCount(2);
    await checkLayout(page, `dashboard ${locale}`, full);

    // request detail: short name, number hidden until accepted
    await page.goto(`/${locale}/owner/requests/${code1}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Kisan R.")).toBeVisible();
    await expect(page.getByText("Kisan Rao")).toHaveCount(0);
    await expect(page.getByText(m.owner.numberAfter)).toBeVisible();
    await checkLayout(page, `request ${locale}`, full);

    // accept: the renter's booking changes and they get a notification
    await page
      .locator("[data-sticky-cta]")
      .getByRole("button", { name: m.owner.accept, exact: true })
      .click();
    await expect(page.getByText(m.status.confirmed).first()).toBeVisible();
    await rp.goto(`/${locale}/bookings/${code1}`);
    await expect(rp.getByText(m.status.confirmed).first()).toBeVisible();
    await rp.goto(`/${locale}/notifications`);
    await expect(rp.getByText(m.notif.type.booking_accepted.replace("{code}", code1))).toBeVisible();

    // decline with a reason
    await page.goto(`/${locale}/owner`);
    await page.getByRole("button", { name: m.owner.decline, exact: true }).click();
    await page.getByRole("radio", { name: m.owner.declineReasons.too_far }).click();
    await page.getByRole("button", { name: m.owner.declineSend }).click();
    await expect(page.getByRole("button", { name: m.owner.accept })).toHaveCount(0);
    await rp.goto(`/${locale}/bookings/${code2}`);
    await expect(rp.getByText(m.status.declined).first()).toBeVisible();
    await rp.goto(`/${locale}/notifications`);
    await expect(rp.getByText(m.notif.type.booking_declined.replace("{code}", code2))).toBeVisible();

    // ---- Calendar: block a day, see the booked one, open it --------------------------------------------------
    await page.goto(`/${locale}/owner`);
    let free = 3;
    while (new Date(inDays(free)).getUTCDay() === 0) free++;
    const month = inDays(free).slice(0, 7);
    // the calendar opens on this month; go forward when the day is in the next one
    if (month !== inDays(0).slice(0, 7)) await page.getByRole("button", { name: m.owner.nextMonth }).click();
    const cell = page.locator(`[data-date="${inDays(free)}"]`);
    await expect(cell).toHaveAttribute("data-state", "free");
    await cell.click();
    await expect(cell).toHaveAttribute("data-state", "blocked");
    await expect
      .poll(
        async () =>
          (
            await sql(
              (s) =>
                s`SELECT 1 FROM machine_blocks WHERE machine_id = ${listed.id} AND day = ${inDays(free)}`,
            )
          ).length,
      )
      .toBe(1);
    // a booked day can't be blocked, it opens the booking
    const next = page.getByRole("button", { name: m.owner.nextMonth });
    await untilInteractive(next);
    if (inDays(accept).slice(0, 7) !== month) await next.click();
    const day = page.locator(`[data-date="${inDays(accept)}"]`);
    await untilInteractive(day);
    await day.click();
    await expect(page).toHaveURL(new RegExp(`/owner/requests/${code1}$`));
    await page.goBack();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // ---- Edit: the price changes ----------------------------------------------------------------------------
    await page.goto(`/${locale}/owner/machines/${listed.id}/edit?step=4`);
    await expect(page.locator("input[inputmode=numeric]")).toHaveValue("1400");
    await page.locator("input[inputmode=numeric]").fill("1500");
    await stepButton(page).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/owner$`));
    await expect
      .poll(
        async () =>
          (
            await sql(
              (s) => s<{ p: number }[]>`SELECT price_paise AS p FROM machines WHERE id = ${listed.id}`,
            )
          )[0].p,
      )
      .toBe(150_000);

    // ---- Pause: it disappears from search -------------------------------------------------------------------
    await page.getByRole("button", { name: m.owner.more.replace("{name}", name) }).click();
    await page.getByRole("button", { name: m.owner.pause, exact: true }).click();
    await expect
      .poll(
        async () =>
          (await sql((s) => s<{ a: boolean }[]>`SELECT active AS a FROM machines WHERE id = ${listed.id}`))[0]
            .a,
      )
      .toBe(false);
    await rp.goto(`/${locale}/rent/results?place=413512&r=10`);
    await expect(rp.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(rp.locator('a[href*="/rent/m/"]', { hasText: model })).toHaveCount(0);

    // ---- Demo admin -----------------------------------------------------------------------------------------
    const bid = (await sql((s) => s<{ id: string }[]>`SELECT id FROM bookings WHERE code = ${code1}`))[0].id;
    const rep = await rp.request.post(`/api/bookings/${bid}/problems`, {
      multipart: { type: "no_show", text: "Tractor came late <b>x</b>" },
    });
    expect(rep.status()).toBe(201);
    // a non-admin gets the 403 page
    const denied = await page.goto(`/${locale}/admin`);
    expect(denied?.status()).toBe(403);
    await expect(page.getByText(m.errors.forbidden).first()).toBeVisible();
    const admin = await signUp(browser, "Demo Admin", "renter");
    await sql((s) => s`UPDATE users SET roles = ARRAY['admin','renter'] WHERE phone = ${admin.phone}`);
    await admin.page.goto(`/${locale}/admin`);
    await expect(admin.page.getByRole("heading", { level: 1 })).toHaveText(m.admin.title);
    await expect(admin.page.getByText(name)).toBeVisible();
    await expect(admin.page.getByText("Tractor came late <b>x</b>").first()).toBeVisible(); // shown as text
    await checkLayout(admin.page, `admin ${locale}`, full);
    await admin.page.locator("li", { hasText: name }).getByRole("button", { name: m.admin.approve }).click();
    await expect
      .poll(
        async () =>
          (
            await sql((s) => s<{ r: string }[]>`SELECT rc_status AS r FROM machines WHERE id = ${listed.id}`)
          )[0].r,
      )
      .toBe("checked");
    await admin.page
      .locator("li", { hasText: code1 })
      .getByRole("button", { name: m.admin.resolve })
      .first()
      .click();
    await expect
      .poll(
        async () =>
          (
            await sql(
              (s) => s<{ s: string }[]>`SELECT status AS s FROM problem_reports WHERE booking_id = ${bid}`,
            )
          )[0].s,
      )
      .toBe("resolved");

    // map tiles are blocked on purpose (offline), so their failed loads are expected
    expect(health.filter((h) => !/ERR_FAILED/.test(h))).toEqual([]);
    await Promise.all([owner.ctx.close(), renter.ctx.close(), admin.ctx.close()]);
  });
}

test("hostile text in a listing is shown as text, never run", async ({ browser }) => {
  test.setTimeout(90_000);
  const owner = await signUp(browser, "Ramesh Patil", "owner");
  const page = owner.page;
  const dialogs: string[] = [];
  page.on("dialog", (d) => {
    dialogs.push(d.message());
    void d.dismiss();
  });
  const evil = `<img src=x onerror="window.__xss=1">`;
  const r = await page.request.post("/api/owner/machines", {
    data: {
      category: "tractor",
      make: evil,
      model: "<script>alert(1)</script>",
      hp: 45,
      year: 2019,
      attachments: [],
      lat: 18.41,
      lng: 76.56,
      village: "Latur",
      pin: "413512",
      priceUnit: "acre",
      priceRupees: 1200,
    },
  });
  expect(r.status()).toBe(201);
  await page.goto("/en/owner");
  await expect(page.getByText("<script>alert(1)</script>").first()).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  expect(dialogs).toEqual([]);
  await owner.ctx.close();
});

test("owners and renters can't reach each other's pages or the admin", async ({ browser }) => {
  test.setTimeout(90_000);
  const renter = await signUp(browser, "Kisan Rao", "renter");
  for (const path of ["/en/owner", "/en/admin", "/en/owner/requests/KR-0001"]) {
    const res = await renter.page.goto(path);
    expect(res?.status(), path).toBe(403);
  }
  // a renter is offered owner mode on the listing page, and it works
  await renter.page.goto("/en/owner/machines/new");
  await renter.page.getByRole("button", { name: MESSAGES.en.owner.modeOn }).click();
  await expect(renter.page.getByRole("heading", { level: 1 })).toHaveText(MESSAGES.en.list.s1);
  // the API says no to anyone who isn't an admin
  for (const path of ["/api/admin/overview", "/api/admin/users?q=a"])
    expect((await renter.page.request.get(path)).status(), path).toBe(403);
  await renter.ctx.close();
  const anon = await newVisitor(browser);
  expect((await anon.page.request.get("/api/admin/overview")).status()).toBe(401);
  await anon.page.goto("/en/admin");
  await expect(anon.page).toHaveURL(/\/en\/login\?next=%2Fen%2Fadmin/);
  await anon.ctx.close();
});
