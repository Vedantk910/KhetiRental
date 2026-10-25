import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page } from "@playwright/test";

export const LOCALES = ["en", "hi", "mr"] as const;
export const WIDTHS = [360, 390, 768, 1024, 1440] as const;

/** Collects console errors and uncaught exceptions for the life of the page. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

export const hasHScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

/** Visible interactive elements smaller than 48 × 48 CSS px. */
export const smallTargets = (page: Page) =>
  page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        "a[href], button, input, select, textarea, [role=radio], [tabindex='0']",
      ),
    ]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        const clipped = s.getPropertyValue("clip") === "rect(0px, 0px, 0px, 0px)"; // .sr-only (the skip link until focused)
        return (
          r.width > 0 &&
          r.height > 0 &&
          s.visibility !== "hidden" &&
          !clipped &&
          !el.closest("[aria-hidden=true]")
        );
      })
      .filter((el) => {
        // A checkbox or radio is tapped through its label.
        const box = el.matches("input[type=checkbox], input[type=radio]") ? (el.closest("label") ?? el) : el;
        const r = box.getBoundingClientRect();
        return r.width < 47.5 || r.height < 47.5;
      })
      .map(
        (el) =>
          `${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 30)}" ${el.getBoundingClientRect().width.toFixed(0)}×${el.getBoundingClientRect().height.toFixed(0)}`,
      ),
  );

export async function expectNoAxeViolations(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const summary = violations.map(
    (v) =>
      `${v.id}: ${v.nodes
        .map((n) => n.target.join(" "))
        .slice(0, 3)
        .join(", ")}`,
  );
  expect(summary, label).toEqual([]);
}

export async function setTheme(page: Page, theme: "light" | "dark") {
  await page.emulateMedia({ colorScheme: theme });
  await page.evaluate((t) => {
    document.documentElement.dataset.theme = t;
  }, theme);
  // Controls animate their colours for 100–120 ms; measure contrast after they settle.
  await page.waitForTimeout(250);
}

/** Waits until React has hydrated the element (its props are attached), so a click reaches its handler. */
export async function untilInteractive(locator: Locator) {
  await expect
    .poll(() => locator.evaluate((el) => Object.keys(el).some((k) => k.startsWith("__reactProps"))))
    .toBe(true);
}

/** Map tiles and any other outside host stay unreachable, so the run never depends on the network. */
export async function offline(page: Page) {
  await page.route(
    (u) => !["localhost", "127.0.0.1"].includes(u.hostname),
    (r) => r.abort(),
  );
}

/** axe in light and dark at 390 and 1440, and no sideways scroll at 320 (the page must already be open). */
export async function checkLayout(page: Page, label: string, full: boolean) {
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

export type Mode = "rich" | "lite" | "none";

/** Makes the page look like a capable desktop (rich), a Save-Data phone (lite), or a reduced-motion user (none). */
export async function asDevice(page: Page, mode: Mode) {
  if (mode === "none") await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript((m) => {
    const define = (o: object, k: string, v: unknown) =>
      Object.defineProperty(o, k, { get: () => v, configurable: true });
    define(navigator, "deviceMemory", 8);
    define(navigator, "hardwareConcurrency", 8);
    define(navigator, "connection", {
      saveData: m === "lite",
      effectiveType: "4g",
      addEventListener() {},
    });
  }, mode);
}
