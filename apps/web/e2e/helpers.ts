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
        const r = el.getBoundingClientRect();
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
