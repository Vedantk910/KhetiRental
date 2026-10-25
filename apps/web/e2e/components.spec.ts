// S2 shows the tractor with the implements that hitch on, and a price tag (buy and rent) for each.
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  asDevice,
  expectNoAxeViolations,
  hasHScroll,
  LOCALES,
  setTheme,
  watchErrors,
  type Mode,
} from "./helpers";

const slot = (page: Page) => page.locator("[data-tractor-slot]");
const list = (page: Page) => page.getByRole("list", { name: "Typical prices to buy or rent" });
const PRICES = [
  "Tractor Buy ₹6,40,000 · Rent ₹700 / hour",
  "Rotavator Buy ₹1,10,000 · Rent ₹400 / hour",
  "Plough Buy ₹35,000 · Rent ₹250 / hour",
  "Seed drill Buy ₹60,000 · Rent ₹300 / hour",
  "Trolley Buy ₹1,50,000 · Rent ₹500 / day",
];
const IMPLEMENT_AT: [number, string][] = [
  [0.1, "rotavator"],
  [0.35, "plough"],
  [0.6, "seedDrill"],
  [0.9, "trolley"],
];

async function toS2(page: Page) {
  await expect(async () => {
    await page.evaluate(() => {
      document.getElementById("s2")!.scrollIntoView({ block: "center", behavior: "instant" });
    });
    await expect(slot(page)).toBeInViewport({ timeout: 500 });
  }).toPass({ timeout: 5000 });
}

/** Moves the scene to a point of the scroll without scrolling, once the pin's 0.4 s scrub has stopped writing it. */
async function setProgress(page: Page, p: number) {
  await page.waitForTimeout(900);
  await slot(page).evaluate((el, v) => {
    el.style.setProperty("--kr-p", String(v));
  }, p);
}

async function richScene(page: Page, locale = "en") {
  await asDevice(page, "rich");
  await page.goto(`/${locale}`);
  await tagsPlaced(page);
}

async function tagsPlaced(page: Page) {
  // The pins build after idle and move the page; keep S2 in view until the scene has placed its first tag.
  await expect(async () => {
    await toS2(page);
    await expect(slot(page).locator("[data-tag='tractor'][data-anchor]")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 25_000 });
}

const overlap = async (a: Locator, b: Locator) => {
  const [x, y] = [await a.boundingBox(), await b.boundingBox()];
  return (
    !!x && !!y && x.x < y.x + y.width && y.x < x.x + x.width && x.y < y.y + y.height && y.y < x.y + x.height
  );
};

/** Both tags sit inside the slot, in separate rows, each over (or clamped toward) the x of its part. */
async function expectTagsAttached(page: Page) {
  // Measured in one browser task, so a frame can't move the tag between reading its anchor and its box.
  const tags = await slot(page).evaluate((el) => {
    const s = el.getBoundingClientRect();
    return [...el.querySelectorAll<HTMLElement>("[data-tag]")].map((t) => {
      const b = t.getBoundingClientRect();
      return {
        x: b.x - s.x,
        y: b.y - s.y,
        w: b.width,
        h: b.height,
        anchor: Number(t.dataset.anchor),
        sw: s.width,
        sh: s.height,
      };
    });
  });
  expect(tags).toHaveLength(2);
  for (const t of tags) {
    expect(t.x, "left edge").toBeGreaterThanOrEqual(0);
    expect(t.x + t.w, "right edge").toBeLessThanOrEqual(t.sw + 0.5);
    expect(t.y).toBeGreaterThanOrEqual(0);
    expect(t.y + t.h).toBeLessThanOrEqual(t.sh);
    const clamped = Math.abs(t.x - 4) < 1.5 || Math.abs(t.x + t.w - (t.sw - 4)) < 1.5;
    const centre = t.x + t.w / 2;
    expect(
      clamped || Math.abs(centre - t.anchor) <= 1.5,
      `tag over its part (anchor ${t.anchor}, centre ${centre})`,
    ).toBe(true);
  }
  const [a, b] = tags;
  expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h, "tags overlap").toBe(
    false,
  );
}

const attached = (page: Page) => expect(() => expectTagsAttached(page)).toPass({ timeout: 4000 });

for (const [width, height] of [
  [390, 844],
  [1440, 900],
] as const) {
  test(`rich ${width}px: a tag per part, aligned to it, apart from each other and the bars`, async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width, height });
    await richScene(page);
    for (const [p, key] of IMPLEMENT_AT) {
      await setProgress(page, p);
      const implement = slot(page).locator(`[data-tag='${key}'][data-anchor]`);
      await expect(implement).toBeVisible();
      await expect(slot(page).locator("[data-tag='tractor']")).toBeVisible();
      await expect(implement).toContainText(/Buy ₹.* Rent ₹/);
      await expect(page.locator(`[data-part='${key}']`)).toHaveAttribute("data-active", "true");
      await attached(page);
      for (const bar of await page.locator(".kr-grow").all())
        expect(await overlap(slot(page).locator("[data-tag]").nth(1), bar)).toBe(false);
    }
    expect(errors).toEqual([]);
  });
}

test("the tag text is real text with the same prices as the list", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await richScene(page);
  await setProgress(page, 0.1);
  await expect(slot(page).locator("[data-tag='rotavator']")).toHaveText(
    "RotavatorBuy ₹1,10,000 · Rent ₹400 / hour",
  );
  await expect(slot(page).locator("[data-tag='tractor']")).toHaveText(
    "TractorBuy ₹6,40,000 · Rent ₹700 / hour",
  );
  await expect(list(page).getByRole("listitem")).toHaveText(
    PRICES.map((t) => t.replace(/^(\S+( drill)?) /, "$1")),
  );
});

for (const theme of ["light", "dark"] as const) {
  test(`axe: S2 with the 3D scene running, ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await richScene(page);
    await setTheme(page, theme);
    await expectNoAxeViolations(page, `S2 rich ${theme}`);
  });
}

for (const mode of ["lite", "none"] as const satisfies Mode[]) {
  test(`${mode}: the same prices as a plain list next to the still, no tags`, async ({ page }) => {
    await asDevice(page, mode);
    await page.goto("/en");
    await toS2(page);
    await expect(slot(page).locator("svg")).toBeVisible();
    await expect(list(page).getByRole("listitem")).toHaveCount(5);
    for (const t of PRICES) await expect(list(page)).toContainText(t.replace(/^(\S+( drill)?) /, "$1"));
    await expect(page.locator("[data-tag]")).toHaveCount(0);
    await expect(page.locator("[data-active]")).toHaveCount(0);
    for (const theme of ["light", "dark"] as const) {
      await setTheme(page, theme);
      await expectNoAxeViolations(page, `S2 ${mode} ${theme}`);
    }
  });
}

test.describe("no sideways scroll", () => {
  for (const locale of LOCALES)
    for (const width of [320, 390, 768, 1024, 1440])
      test(`${locale} at ${width}px`, async ({ page }) => {
        await asDevice(page, "lite");
        await page.setViewportSize({ width, height: 800 });
        await page.goto(`/${locale}`);
        await toS2(page);
        expect(await hasHScroll(page)).toBe(false);
      });
  test("rich, Marathi, 320px, 3D tags showing", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await richScene(page, "mr");
    await setProgress(page, 0.9);
    await expect(slot(page).locator("[data-tag='trolley'][data-anchor]")).toBeVisible();
    expect(await hasHScroll(page)).toBe(false);
    await attached(page);
  });
});

test.describe("adversarial", () => {
  test("resizing while on S2 keeps the tags attached", async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await richScene(page);
    for (const [w, h, p] of [
      [320, 700, 0.35],
      [1024, 700, 0.6],
      [390, 844, 0.9],
      [1440, 900, 0.1],
    ] as const) {
      await page.setViewportSize({ width: w, height: h });
      await toS2(page);
      await setProgress(page, p);
      await toS2(page); // the pins rebuild on resize and can move the page
      await page.waitForTimeout(150);
      await attached(page);
      expect(await hasHScroll(page)).toBe(false);
    }
    expect(errors).toEqual([]);
  });

  test("rapid scrolling through and past S2 raises no errors and ends with tags in place", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await richScene(page);
    for (let i = 0; i < 12; i++) {
      await page.mouse.wheel(0, i % 2 ? -900 : 700);
      await page.waitForTimeout(30);
    }
    await toS2(page);
    await setProgress(page, 0.6);
    await expect(slot(page).locator("[data-tag='seedDrill'][data-anchor]")).toBeVisible();
    await attached(page);
    expect(errors).toEqual([]);
  });

  test("changing language on S2 re-labels the tags in that language", async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await richScene(page);
    await setProgress(page, 0.1);
    await page.goto("/hi");
    await tagsPlaced(page);
    await expect(slot(page).locator("[data-tag='tractor']")).toContainText("ट्रैक्टर");
    await expect(slot(page).locator("[data-tag='tractor']")).toContainText("₹6,40,000");
    await attached(page);
    expect(errors).toEqual([]);
  });
});
