import { expect, test, type Browser, type Page } from "@playwright/test";
import { untilInteractive, watchErrors } from "./helpers";

const USERS = 5;

/** Runs `fn` for USERS isolated users at once, each in its own browser context. */
async function crowd(browser: Browser, fn: (page: Page, u: number) => Promise<void>) {
  await Promise.all(
    Array.from({ length: USERS }, async (_, u) => {
      const ctx = await browser.newContext({
        viewport: u % 2 ? { width: 390, height: 844 } : { width: 1024, height: 800 },
      });
      const page = await ctx.newPage();
      const errors = watchErrors(page);
      await fn(page, u);
      expect(errors, `user ${u} console errors`).toEqual([]);
      await ctx.close();
    }),
  );
}

const focusInside = (page: Page, selector: string) =>
  page.evaluate((s) => !!document.querySelector(s)?.contains(document.activeElement), selector);

test("5 users hammer the language switch: URL, lang, pressed state and cookie always agree", async ({
  browser,
}) => {
  await crowd(browser, async (page, u) => {
    await page.goto("/en/dev/ui?q=1");
    const order = ["hi", "mr", "en", "mr", "hi", "en", "hi", "mr"] as const;
    const names = { en: "English", hi: "हिंदी", mr: "मराठी" };
    // Click as fast as the page allows, without waiting for each navigation.
    for (let i = 0; i < 12; i++) {
      const l = order[(i + u) % order.length];
      await page
        .getByRole("banner")
        .getByRole("button", { name: names[l] })
        .click({ noWaitAfter: true, timeout: 5000 })
        .catch(() => {});
    }
    // Then one deliberate final choice; everything must settle on it.
    const last = (["en", "hi", "mr"] as const)[u % 3];
    await page.waitForLoadState("networkidle");
    await page.getByRole("banner").getByRole("button", { name: names[last] }).click();
    await expect(page).toHaveURL(new RegExp(`/${last}/dev/ui\\?q=1$`));
    await expect(page.locator("html")).toHaveAttribute("lang", last);
    await expect(page.getByRole("banner").locator("[aria-pressed=true]")).toHaveCount(1);
    await expect(page.getByRole("banner").getByRole("button", { name: names[last] })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const cookie = (await page.context().cookies()).find((c) => c.name === "NEXT_LOCALE");
    expect(cookie?.value).toBe(last);
  });
});

test("5 users spam the sheet: Escape/✕/overlay are ignored while submitting, focus never escapes", async ({
  browser,
}) => {
  await crowd(browser, async (page) => {
    await page.goto("/en/dev/ui");
    const opener = page.getByRole("button", { name: "Open sheet" });

    // open/close spam
    for (let i = 0; i < 10; i++) {
      await opener.click();
      await expect(page.getByRole("dialog")).toHaveCount(1);
      expect(await focusInside(page, "[role=dialog]")).toBe(true);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(opener).toBeFocused();
    }

    // submit, then try every way out while it is in flight
    await opener.click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Yes, cancel" }).click();
    await expect(dialog).toHaveAttribute("aria-busy", "true");
    for (let i = 0; i < 15; i++) await page.keyboard.press("Escape");
    // force: Playwright refuses aria-disabled targets; a determined user does not.
    for (let i = 0; i < 3; i++) await dialog.getByRole("button", { name: "Close" }).click({ force: true });
    await page.mouse.click(5, 5); // the overlay
    await dialog.getByRole("button", { name: "Keep booking" }).click();
    for (let i = 0; i < 10; i++) await page.keyboard.press("Tab");
    await expect(dialog).toBeVisible();
    expect(await focusInside(page, "[role=dialog]")).toBe(true);

    // the submit finishes on its own: sheet closes, focus returns, a toast says so
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 5000 });
    await expect(opener).toBeFocused();
    await expect(page.getByRole("status")).toContainText("Cancelled");
  });
});

test("5 users mash the chip groups by keyboard: one checked, one tab stop, focus on it", async ({
  browser,
}) => {
  await crowd(browser, async (page, u) => {
    await page.goto("/en/dev/ui");
    const group = page.getByRole("radiogroup", { name: "When?" });
    await group.getByRole("radio", { checked: true }).focus();
    const keys = ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"];
    for (let i = 0; i < 60; i++) await page.keyboard.press(keys[(i * 7 + u) % keys.length]);
    await expect(group.getByRole("radio", { checked: true })).toHaveCount(1);
    await expect(group.locator("[tabindex='0']")).toHaveCount(1);
    await expect(group.getByRole("radio", { checked: true })).toBeFocused();

    const multi = page.getByRole("group", { name: "Pick one or more jobs" });
    await multi.locator("[tabindex='0']").focus();
    for (let i = 0; i < 60; i++) await page.keyboard.press(i % 4 === 0 ? "Space" : keys[(i + u) % 4]);
    await expect(multi.locator("[tabindex='0']")).toHaveCount(1);
    expect(await page.evaluate(() => document.activeElement?.getAttribute("tabindex"))).toBe("0");
  });
});

test("5 users long-press the stepper: it repeats, stops at the bounds and on release", async ({
  browser,
}) => {
  await crowd(browser, async (page) => {
    await page.goto("/en/dev/ui");
    const value = page.getByRole("spinbutton", { name: "Field size" });
    const more = page.getByRole("button", { name: "More acres" });
    const less = page.getByRole("button", { name: "Fewer acres" });
    await untilInteractive(more);

    const press = async (b: typeof more) => {
      await b.scrollIntoViewIfNeeded();
      const box = (await b.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
    };
    const now = async () => Number(await value.getAttribute("aria-valuenow"));
    // Held: it keeps repeating (2.5 + several steps), however slow the machine is.
    await press(more);
    await expect.poll(now, { timeout: 10_000 }).toBeGreaterThan(4);
    await page.mouse.up();
    // A repeat already queued at release may still land under load; after that the value must hold.
    await page.waitForTimeout(150);
    const up = await now();
    await page.waitForTimeout(400);
    expect(await now()).toBe(up); // stopped on release

    await press(less);
    await expect.poll(now, { timeout: 20_000 }).toBe(0.5);
    await page.mouse.up();
    await expect(value).toHaveAttribute("aria-valuenow", "0.5");
    await expect(less).toHaveAttribute("aria-disabled", "true");
    await expect(value).toHaveValue("0.5");

    // Typed Devanagari digits are clamped to the max
    await value.fill("९९९");
    await value.press("Enter");
    await expect(value).toHaveAttribute("aria-valuenow", "50");
  });
});
