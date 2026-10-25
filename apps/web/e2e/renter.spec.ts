import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { devCode, freshPhone, newVisitor, requestCode, sql, typeCode, watchHealth } from "./auth-helpers";
import { expectNoAxeViolations, hasHScroll, setTheme } from "./helpers";

type Messages = typeof import("../messages/en.json");
const load = (l: string) =>
  JSON.parse(readFileSync(new URL(`../messages/${l}.json`, import.meta.url), "utf8")) as Messages;
const MESSAGES = { en: load("en"), hi: load("hi"), mr: load("mr") };
const LOCALES = ["mr", "hi", "en"] as const;

/** Map tiles and any other outside host stay unreachable, so the run never depends on the network. */
async function offline(page: Page) {
  await page.route(
    (u) => !["localhost", "127.0.0.1"].includes(u.hostname),
    (r) => r.abort(),
  );
}

for (const locale of LOCALES) {
  const m = MESSAGES[locale];
  test(`renter journey in ${locale}: search, book, pay, my bookings, notification, cancel, report`, async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const { ctx, page } = await newVisitor(browser);
    page.setDefaultTimeout(10_000);
    await offline(page);
    const health = watchHealth(ctx);

    // A machine of our own near Latur, so the run never depends on the sample data.
    const make = `Kubota${Date.now()}${locale}`;
    await sql(async (s) => {
      const [o] = await s<{ id: string }[]>`INSERT INTO users (name, email, roles)
        VALUES ('Ramesh Patil', ${`own.${make.toLowerCase()}@example.test`}, ARRAY['owner']) RETURNING id`;
      await s`INSERT INTO machines (owner_id, category, make, model, hp, year, attachments, location, village, pin,
          price_unit, price_paise, active, rc_status)
        VALUES (${o.id}, 'tractor', ${make}, 'MU5501', 55, 2020, ARRAY['plough'],
          ST_SetSRID(ST_MakePoint(76.5604, 18.4088), 4326)::geography, 'Latur', '413512', 'hour', 70000, true, 'checked')`;
    });

    // A fresh renter (sign-up itself is covered by login.spec).
    const phone = freshPhone();
    await requestCode(page, phone, { signup: { name: "Kisan Rao", role: "renter" } });
    await typeCode(page, await devCode(page));
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page).toHaveURL(/\/en\/rent$/);

    // Search
    await page.goto(`/${locale}/rent`);
    await page.getByRole("radio", { name: m.jobs.plough }).click();
    await page.getByRole("combobox").fill("413512");
    await page.getByRole("option").first().click();
    await expectNoAxeViolations(page, `search ${locale}`);
    await page.getByRole("button", { name: m.search.cta }).click();

    // Results: filters live in the URL
    await expect(page).toHaveURL(/\/rent\/results\?/);
    expect(new URL(page.url()).searchParams.get("job")).toBe("plough");
    const card = page.locator('a[href*="/rent/m/"]', { hasText: make }).first();
    await expect(card).toBeVisible();
    await expectNoAxeViolations(page, `results ${locale}`);
    const resultsUrl = page.url();
    await card.click();

    // Detail
    await expect(page).toHaveURL(/\/rent\/m\/[0-9a-f-]{36}/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoAxeViolations(page, `detail ${locale}`);
    const detailUrl = page.url();
    await page.locator('a[href*="/book?"]:visible').first().click();

    // Booking: 3 steps, then the demo payment page
    await expect(page).toHaveURL(/\/book\?.*step=1|\/book\?/);
    await page.getByRole("button", { name: m.common.next }).click();
    await expect(page).toHaveURL(/step=2/);
    await expectNoAxeViolations(page, `booking step 2 ${locale}`);
    await page.getByRole("button", { name: m.common.next }).click();
    await expect(page).toHaveURL(/step=3/);
    await page.getByRole("button", { name: /₹/ }).last().click();
    await expect(page).toHaveURL(/\/book\/pay/);
    await page.getByLabel(m.pay.upiId).fill("kisan@upi");
    await page.getByRole("button", { name: /₹/ }).last().click();

    // Confirmation, then my bookings
    await expect(page).toHaveURL(/\/bookings\/KR-\d{4}/);
    const code = /KR-\d{4}/.exec(page.url())![0];
    await expectNoAxeViolations(page, `booking ${locale}`);
    await page.goto(`/${locale}/bookings`);
    await expect(page.getByText(code).first()).toBeVisible();
    await expectNoAxeViolations(page, `my bookings ${locale}`);

    // The owner accepts (done in the database here; the owner flow has its own tests)
    await sql(async (s) => {
      await s`UPDATE bookings SET status = 'CONFIRMED', confirmed_at = now() WHERE code = ${code} AND status = 'REQUESTED'`;
      await s`INSERT INTO notifications (user_id, type, booking_id)
        SELECT renter_id, 'booking_accepted', id FROM bookings WHERE code = ${code}`;
    });
    await page.goto(`/${locale}/notifications`);
    const accepted = m.notif.type.booking_accepted.replace("{code}", code);
    await expect(page.getByText(accepted)).toBeVisible();
    await expectNoAxeViolations(page, `notifications ${locale}`);

    // Report a problem, then cancel
    await page.goto(`/${locale}/bookings/${code}/problem`);
    await page.getByRole("radio", { name: m.problem.noShow }).click();
    await page.getByRole("button", { name: m.problem.send }).click();
    await expect(page).toHaveURL(new RegExp(`/bookings/${code}$`));
    await page.getByRole("button", { name: m.bookings.cancel, exact: true }).first().click();
    await page.getByRole("button", { name: m.cancel.yes }).click();
    await expect(page.getByText(m.bookings.tl.cancelled).first()).toBeVisible();

    // 320 px wide: nothing scrolls sideways on the key pages
    await page.setViewportSize({ width: 320, height: 800 });
    for (const path of ["rent", "bookings", `bookings/${code}`, "notifications"]) {
      await page.goto(`/${locale}/${path}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await hasHScroll(page), `${path} at 320px`).toBe(false);
    }
    // Desktop width in dark mode: still readable and nothing scrolls sideways.
    if (locale === "en") {
      await page.setViewportSize({ width: 1440, height: 900 });
      for (const url of [
        `/${locale}/rent`,
        resultsUrl,
        detailUrl,
        `/${locale}/bookings`,
        `/${locale}/bookings/${code}`,
      ]) {
        await page.goto(url);
        await expect(page.getByRole("heading", { level: 1 })).toBeAttached();
        await setTheme(page, "dark");
        await expectNoAxeViolations(page, `${url} dark 1440`);
        expect(await hasHScroll(page), `${url} at 1440px`).toBe(false);
      }
    }

    // Another signed-in renter who learns the code sees nothing of the booking.
    const stranger = await newVisitor(browser);
    await requestCode(stranger.page, freshPhone(), { signup: { name: "Other Renter", role: "renter" } });
    await typeCode(stranger.page, await devCode(stranger.page));
    await stranger.page.getByRole("button", { name: "Verify" }).click();
    await expect(stranger.page).toHaveURL(/\/rent$/);
    for (const path of [`bookings/${code}`, `bookings/${code}/problem`]) {
      const res = await stranger.page.goto(`/${locale}/${path}`);
      // A "not found" page either way: nothing about the booking reaches the stranger.
      expect(res?.status(), `${path} for a stranger`).toBeLessThan(500);
      await expect(stranger.page.getByText(m.bookings.notFound)).toBeVisible();
      await expect(stranger.page.getByText(make)).toHaveCount(0);
      await expect(stranger.page.getByText("Kisan Rao")).toHaveCount(0);
    }
    await stranger.ctx.close();

    expect(health).toEqual([]);
    await ctx.close();
  });
}
