// REVIEW A-10: installable, and a friendly page instead of the browser's dinosaur when the network is down.
// Runs against the production build, where the service worker is registered.
import { expect, test, type Page } from "@playwright/test";
import { newVisitor, signUp, watchHealth } from "./auth-helpers";
import { checkLayout } from "./helpers";

/** Waits until the worker controls this page, so the next navigation goes through it. */
async function controlled(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((done) => {
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          done();
        });
      });
  });
}

const cachedUrls = (page: Page) =>
  page.evaluate(async () => {
    const out: string[] = [];
    for (const name of await caches.keys())
      for (const r of await (await caches.open(name)).keys()) out.push(new URL(r.url).pathname);
    return out;
  });

test("the manifest is served, valid, and its icons are real PNGs of the right size", async ({
  page,
  request,
}) => {
  await page.goto("/en");
  expect(await page.locator('link[rel="manifest"]').getAttribute("href")).toBe("/manifest.webmanifest");
  const res = await request.get("/manifest.webmanifest");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toMatch(/json/);
  const m = (await res.json()) as {
    name: string;
    short_name: string;
    start_url: string;
    display: string;
    theme_color: string;
    background_color: string;
    icons: { src: string; sizes: string; type: string; purpose?: string }[];
  };
  expect(m).toMatchObject({
    name: "KhetiRental",
    short_name: "KhetiRental",
    start_url: "/",
    display: "standalone",
    theme_color: "#223585",
    background_color: "#FAF8F4",
  });
  expect(m.icons.some((i) => i.sizes === "192x192" && i.purpose === "any")).toBe(true);
  expect(m.icons.some((i) => i.sizes === "512x512" && i.purpose === "any")).toBe(true);
  expect(m.icons.some((i) => i.sizes === "512x512" && i.purpose === "maskable")).toBe(true);
  for (const icon of m.icons) {
    const png = await request.get(icon.src);
    expect(png.status(), icon.src).toBe(200);
    expect(png.headers()["content-type"]).toBe("image/png");
    const b = await png.body();
    expect(b.subarray(1, 4).toString(), icon.src).toBe("PNG");
    const [w, h] = icon.sizes.split("x").map(Number);
    expect([b.readUInt32BE(16), b.readUInt32BE(20)], icon.src).toEqual([w, h]);
  }
});

test("Chrome finds nothing in the way of installing the app", async ({ page }) => {
  await page.goto("/en");
  await controlled(page);
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = (await cdp.send("Page.getInstallabilityErrors")) as {
    installabilityErrors: { errorId: string }[];
  };
  expect(installabilityErrors).toEqual([]);
});

test("the service worker registers on the production build, with the CSP and cache headers it needs", async ({
  page,
  request,
}) => {
  const health = watchHealth(page);
  await page.goto("/en");
  const script = await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.scriptURL);
  expect(script).toMatch(/\/sw\.js$/);
  const sw = await request.get("/sw.js");
  expect(sw.headers()["cache-control"]).toBe("no-cache");
  expect(sw.headers()["content-security-policy"]).toContain("worker-src 'self'");
  expect(health).toEqual([]);
});

test("offline, any page shows the offline page in the visitor's language; Try again recovers", async ({
  browser,
}) => {
  const { ctx, page } = await newVisitor(browser);
  await page.goto("/en");
  await controlled(page);
  await ctx.setOffline(true);

  await page.goto("/mr/rent");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("तुम्ही ऑफलाइन आहात");
  await expect(page.locator("html")).toHaveAttribute("lang", "mr");
  await page.goto("/hi/help");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("आप ऑफ़लाइन हैं");
  await page.goto("/en/how-we-price");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("You are offline");
  await checkLayout(page, "offline page", true);

  await ctx.setOffline(false);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("You are offline");
  await ctx.close();
});

test("signed-in answers and pages are never served from, or put in, the cache", async ({ browser }) => {
  const u = await signUp(browser, "Kisan Cache", "renter");
  const { page } = u;
  await page.goto("/en/settings");
  await controlled(page);
  // Signed-in traffic: the API and a private page, then a reload so everything has been fetched under the worker.
  const me = await page.evaluate(async () => (await fetch("/api/me")).json());
  expect(me).toMatchObject({ name: "Kisan Cache" });
  await page.goto("/en/bookings");
  await page.goto("/en/settings");
  await expect(page.getByLabel("Name")).toHaveValue("Kisan Cache");

  const urls = await cachedUrls(page);
  expect(urls).toContain("/offline.html");
  expect(urls.some((p) => p.startsWith("/_next/static/"))).toBe(true);
  expect(urls.filter((p) => p.startsWith("/api/") || /^\/(en|hi|mr)(\/|$)/.test(p))).toEqual([]);

  await u.ctx.setOffline(true);
  // The API call fails like any offline request; it is not answered from memory.
  const offlineApi = await page.evaluate(() =>
    fetch("/api/me").then(
      () => "answered",
      () => "failed",
    ),
  );
  expect(offlineApi).toBe("failed");
  // A private page gives the offline page, and nothing of the person.
  await page.goto("/en/settings");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("You are offline");
  await expect(page.getByText("Kisan Cache")).toHaveCount(0);
  await expect(page.getByText(u.phone)).toHaveCount(0);
  await u.ctx.close();
});
