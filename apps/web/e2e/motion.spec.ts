import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations, hasHScroll, LOCALES, setTheme, watchErrors } from "./helpers";

type Mode = "rich" | "lite" | "none";

/** Makes the page look like a capable desktop (rich), a Save-Data phone (lite), or a reduced-motion user (none). */
async function asDevice(page: Page, mode: Mode) {
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

/** Records the 3D model and the two lazy chunks (found by a marker string each one contains). */
function watchLazy(page: Page) {
  const seen = { glb: 0, scene: 0, pins: 0 };
  const reads: Promise<void>[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/models/tractor.glb")) seen.glb++;
  });
  page.on("response", (r) => {
    if (!/\/_next\/static\/.*\.js/.test(r.url())) return;
    reads.push(
      r
        .text()
        .then((t) => {
          if (t.includes("kr-3d-scene")) seen.scene++;
          if (t.includes("kr-story-pins")) seen.pins++;
        })
        .catch(() => undefined),
    );
  });
  return { seen, settled: () => Promise.all(reads).then(() => seen) };
}

async function scrollThrough(page: Page) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= h; y += 400) {
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(40);
  }
}

const slot = (page: Page) => page.locator("[data-tractor-slot]");
const scaleX = (page: Page, sel: string) =>
  page.locator(sel).evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).a);

test.describe("3D and pins never load unless motion is rich", () => {
  for (const mode of ["lite", "none"] as const) {
    test(`${mode}: no 3D chunk, no GSAP chunk, no model, still tractor shown`, async ({ page }) => {
      const lazy = watchLazy(page);
      const errors = watchErrors(page);
      await asDevice(page, mode);
      await page.goto("/en");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-motion", mode);
      await scrollThrough(page);
      await slot(page).scrollIntoViewIfNeeded();
      await page.waitForTimeout(2500);
      expect(await lazy.settled()).toEqual({ glb: 0, scene: 0, pins: 0 });
      await expect(slot(page).locator("svg")).toBeVisible();
      await expect(slot(page).locator("canvas")).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }

  test("a low-memory phone is lite too", async ({ page }) => {
    const lazy = watchLazy(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "deviceMemory", { get: () => 2 });
    });
    await page.goto("/en");
    await expect(page.locator("html")).toHaveAttribute("data-motion", "lite");
    await slot(page).scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000);
    expect(await lazy.settled()).toEqual({ glb: 0, scene: 0, pins: 0 });
  });

  test("rich: the model and chunks load after idle once S2 is near, and the canvas replaces the still", async ({
    page,
  }) => {
    const lazy = watchLazy(page);
    const errors = watchErrors(page);
    await asDevice(page, "rich");
    await page.goto("/en", { waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("data-motion", "rich");
    expect((await lazy.settled()).glb, "nothing 3D before S2 is near").toBe(0);
    await slot(page).scrollIntoViewIfNeeded();
    await expect(slot(page).locator("canvas")).toBeVisible({ timeout: 15_000 });
    const seen = await lazy.settled();
    expect(seen.glb).toBe(1);
    expect(seen.scene).toBeGreaterThan(0);
    expect(seen.pins).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test("rich on a roomy screen: the story sections are pinned; lite never pins", async ({ page }) => {
    await asDevice(page, "rich");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en");
    await expect(page.locator("[data-pinned]")).not.toHaveCount(0, { timeout: 10_000 });
    const lite = await page.context().newPage();
    await asDevice(lite, "lite");
    await lite.setViewportSize({ width: 1440, height: 900 });
    await lite.goto("/en");
    await lite.waitForTimeout(2000);
    await expect(lite.locator("[data-pinned]")).toHaveCount(0);
  });

  test("the model is at most 400 KB", async ({ request }) => {
    const res = await request.get("/models/tractor.glb");
    expect(res.ok()).toBe(true);
    expect((await res.body()).byteLength).toBeLessThanOrEqual(400 * 1024);
  });
});

test.describe("fallbacks", () => {
  test("no WebGL: the still stays and nothing 3D is fetched", async ({ page }) => {
    const lazy = watchLazy(page);
    const errors = watchErrors(page);
    await asDevice(page, "rich");
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.getContext = () => null;
    });
    await page.goto("/en");
    await slot(page).scrollIntoViewIfNeeded();
    await page.waitForTimeout(2500);
    await expect(slot(page).locator("svg")).toBeVisible();
    await expect(slot(page).locator("canvas")).toHaveCount(0);
    expect((await lazy.settled()).glb).toBe(0);
    expect(errors).toEqual([]);
  });

  test("a lost WebGL context hands the slot back to the still without errors", async ({ page }) => {
    const errors = watchErrors(page);
    await asDevice(page, "rich");
    await page.goto("/en");
    await slot(page).scrollIntoViewIfNeeded();
    const canvas = slot(page).locator("canvas");
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await canvas.evaluate((c) => c.dispatchEvent(new Event("webglcontextlost", { cancelable: true })));
    await expect(canvas).toHaveCount(0);
    await expect(slot(page).locator("svg")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("a missing model file falls back to the still", async ({ page }) => {
    await asDevice(page, "rich");
    await page.route("**/models/tractor.glb", (r) => r.fulfill({ status: 404, body: "no" }));
    await page.goto("/en");
    await slot(page).scrollIntoViewIfNeeded();
    await page.waitForTimeout(3000);
    await expect(slot(page).locator("canvas")).toHaveCount(0);
    await expect(slot(page).locator("svg")).toBeVisible();
  });
});

test.describe("reduced motion", () => {
  test("shows the still scene, final counters and final bar states", async ({ page }) => {
    await asDevice(page, "none");
    await page.goto("/en");
    const visible = page
      .getByRole("region", { name: "Key facts about Indian farms" })
      .locator("[aria-hidden=true]");
    await expect(visible).toContainText("86%");
    await expect(visible).toContainText("1.08");
    await expect(visible).toContainText("47%");
    expect(
      await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length),
    ).toBe(0);
    await slot(page).scrollIntoViewIfNeeded();
    expect(await scaleX(page, ".kr-shrink")).toBeCloseTo(0.12, 2);
    expect(await scaleX(page, ".kr-grow")).toBe(1);
    await expect(page.locator(".kr-reveal").first()).toHaveCSS("opacity", "1");
    await expect(slot(page).locator("svg")).toBeVisible();
  });
});

test.describe("S2 bars", () => {
  test("the buy bar shrinks from full width as S2 scrolls in (lite, CSS)", async ({ page }) => {
    await asDevice(page, "lite");
    await page.goto("/en");
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    const before = await scaleX(page, ".kr-shrink");
    expect(before).toBeGreaterThan(0.9);
    await page.evaluate(() => {
      document.querySelector(".kr-shrink")!.scrollIntoView({ block: "center", behavior: "instant" });
    });
    await expect.poll(() => scaleX(page, ".kr-shrink")).toBeLessThan(0.2);
  });
});

for (const mode of ["rich", "lite", "none"] as const) {
  test(`axe is clean on the welcome page in ${mode} mode, light and dark`, async ({ page }) => {
    await asDevice(page, mode);
    await page.goto("/en");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    for (const theme of ["light", "dark"] as const) {
      await setTheme(page, theme);
      await expectNoAxeViolations(page, `${mode} ${theme} top`);
    }
    await page.locator("#s2").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    for (const theme of ["light", "dark"] as const) {
      await setTheme(page, theme);
      await expectNoAxeViolations(page, `${mode} ${theme} s2`);
    }
  });
}

for (const locale of LOCALES) {
  for (const width of [320, 768, 1440]) {
    test(`rich ${locale} at ${width}px: no errors, no sideways scroll top to bottom`, async ({ page }) => {
      const errors = watchErrors(page);
      await asDevice(page, "rich");
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${locale}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await hasHScroll(page)).toBe(false);
      await scrollThrough(page);
      expect(await hasHScroll(page)).toBe(false);
      expect(errors).toEqual([]);
    });
  }
}

test.describe("adversarial", () => {
  const reachable = async (page: Page) => {
    // every story title can be scrolled to and is readable, and the page bottom is reachable (no stuck pin)
    for (const id of ["s1", "s2", "s3", "s4", "s5", "s6", "s7"]) {
      await page.evaluate((i) => {
        document.getElementById(i)!.scrollIntoView({ block: "center", behavior: "instant" });
      }, id);
      await page.waitForTimeout(80);
      await expect(page.locator(`#${id}`)).toBeInViewport();
    }
    await page.evaluate(() => {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
    });
    await page.waitForTimeout(200);
    expect(
      await page.evaluate(
        () => Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2,
      ),
    ).toBe(true);
    await expect(page.getByRole("contentinfo")).toBeInViewport();
  };

  test("rapid scroll up and down, resizing across breakpoints and tab hide/show", async ({ page }) => {
    const errors = watchErrors(page);
    await asDevice(page, "rich");
    await page.goto("/en");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await slot(page).scrollIntoViewIfNeeded();
    await expect(slot(page).locator("canvas")).toBeVisible({ timeout: 15_000 });
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, i % 2 ? -4000 : 5000);
      await page.waitForTimeout(30);
    }
    for (const [w, h] of [
      [1440, 900],
      [390, 800],
      [768, 500],
      [320, 640],
      [1024, 900],
      [1440, 700],
    ]) {
      await page.setViewportSize({ width: w, height: h });
      await page.mouse.wheel(0, 700);
      await page.waitForTimeout(60);
    }
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { get: () => true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { get: () => false, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(500);
    expect(await hasHScroll(page)).toBe(false);
    await reachable(page);
    expect(errors).toEqual([]);
  });

  test("pins that build while you are mid-page do not throw you off the section you jumped to", async ({
    page,
  }) => {
    await asDevice(page, "rich");
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/en");
    await page.evaluate(() => {
      document.getElementById("s4")!.scrollIntoView({ block: "center", behavior: "instant" });
    });
    await expect(page.locator("[data-pinned]")).not.toHaveCount(0, { timeout: 10_000 });
    await page.waitForTimeout(500);
    await expect(page.locator("#s4")).toBeInViewport({ ratio: 0.5 });
    // and dropping the pins (reduced motion on) keeps you there too
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator("[data-pinned]")).toHaveCount(0);
    await page.waitForTimeout(300);
    await expect(page.locator("#s4")).toBeInViewport({ ratio: 0.5 });
  });

  test("short viewport (landscape phone): pins are skipped, content stays reachable", async ({ page }) => {
    await asDevice(page, "rich");
    await page.setViewportSize({ width: 844, height: 360 });
    await page.goto("/en");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForTimeout(1000);
    await reachable(page);
  });

  test("switching language mid-scroll keeps everything working", async ({ page }) => {
    const errors = watchErrors(page);
    await asDevice(page, "rich");
    await page.goto("/en");
    await page.locator("#s2").scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await page.goto("/mr");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForTimeout(800);
    await reachable(page);
    await page.goto("/hi");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await reachable(page);
    expect(errors).toEqual([]);
  });

  test("toggling reduced motion live drops 3D and pins, and back", async ({ page }) => {
    const errors = watchErrors(page);
    await asDevice(page, "rich");
    await page.goto("/en");
    await slot(page).scrollIntoViewIfNeeded();
    await expect(slot(page).locator("canvas")).toBeVisible({ timeout: 15_000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator("html")).toHaveAttribute("data-motion", "none");
    await expect(slot(page).locator("canvas")).toHaveCount(0);
    await expect(slot(page).locator("svg")).toBeVisible();
    await expect(page.locator("[data-pinned]")).toHaveCount(0);
    await expect.poll(() => scaleX(page, ".kr-shrink")).toBeCloseTo(0.12, 2);
    await reachable(page);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(page.locator("html")).toHaveAttribute("data-motion", "rich");
    await slot(page).scrollIntoViewIfNeeded();
    await expect(slot(page).locator("canvas")).toBeVisible({ timeout: 15_000 });
    await reachable(page);
    expect(errors).toEqual([]);
  });
});
