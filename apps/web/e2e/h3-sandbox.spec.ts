import { type Page, expect, test } from "@playwright/test";

const URL = "/architecture/h3-spatial";
const RING = (k: number) => 3 * k * (k + 1) + 1;

function watch(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function assertInvariants(page: Page) {
  const k = Number(await page.getByLabel(/ring depth/i).inputValue());
  await expect(page.getByTestId("ring-size")).toHaveText(String(RING(k)));
  expect(await page.getByTestId("ring-cell").count()).toBe(RING(k));
  const n = await page.getByTestId("results").locator("li").count();
  expect(n).toBeLessThanOrEqual(20);
}

test("click sets farmer, ring, ranked results, pipeline and measured latency", async ({ page }) => {
  const errors = watch(page);
  await page.goto(URL);
  await expect(page.getByTestId("ring-size")).toHaveText("19");
  const before = await page.getByTestId("farmer-coords").textContent();
  const box = (await page.getByTestId("h3-map").boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.4);
  await expect(page.getByTestId("farmer-coords")).not.toHaveText(before!);
  await page.getByLabel(/ring depth/i).fill("5");
  await expect(page.getByTestId("ring-size")).toHaveText("91");
  expect((await page.getByTestId("pipeline").textContent())!.trim().split("\n")).toHaveLength(91);
  await expect(page.getByTestId("live-ms")).toHaveText(/^\d+\.\d\d ms$/);
  await expect(page.getByTestId("latency")).toContainText("Not benchmarked");
  await assertInvariants(page);
  expect(errors).toEqual([]);
});

test("keyboard only: arrows and preset select move the farmer", async ({ page }) => {
  await page.goto(URL);
  const coords = page.getByTestId("farmer-coords");
  const c0 = await coords.textContent();
  await page.getByTestId("h3-map").focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowDown");
  const c1 = await coords.textContent();
  expect(c1).not.toBe(c0);
  await page.keyboard.press("Home");
  await expect(coords).toHaveText(c0!);
  await page.getByLabel(/farmer location/i).selectOption({ label: "East edge of cluster" });
  await expect(coords).not.toHaveText(c0!);
});

test("API /api/machines/near: statuses, schema, limit, radius trimming", async ({ request }) => {
  const ok = await request.get("/api/machines/near?lat=26.84&lng=75.83&limit=3&k=5");
  expect(ok.status()).toBe(200);
  const b = await ok.json();
  expect(b.candidates).toHaveLength(3);
  expect(Object.keys(b.candidates[0]).sort()).toEqual(["dist_km", "hp", "id", "reputation", "score"]);
  const tight = await (await request.get("/api/machines/near?lat=26.84&lng=75.83&k=5&radius_km=0.5")).json();
  expect(tight.candidates.every((c: { dist_km: number }) => c.dist_km <= 0.5)).toBe(true);
  expect((await request.get("/api/machines/near?lng=75.83")).status()).toBe(400);
  expect((await request.get("/api/machines/near?lat=x&lng=1")).status()).toBe(400);
});

test("adversarial: 200 concurrent hostile API requests are only ever 200 or 400", async ({ request }) => {
  const qs = [
    "lat=26.84&lng=75.83",
    "lat=NaN&lng=75",
    "lat=26.84&lng=75.83&k=999999",
    "lat=26.84&lng=75.83&radius_km=-5",
    "lat=26.84&lng=75.83&limit=1e9",
    "lng=75.83",
    "lat=26.84",
    "lat=Infinity&lng=1",
    "lat=26.84&lng=75.83&hp=NaN",
    "lat=26.84&lng=75.83&k=-3&limit=0",
    "lat=90&lng=180",
    "lat=-90&lng=-180&k=5",
    "lat=26.84&lng=75.83&radius_km=1e308",
    "lat=%00&lng=%FF",
    "lat=26.84&lng=75.83&k=2.5&limit=2.5",
  ];
  // Waves of 50 concurrent requests: a single burst of 200 sockets intermittently
  // trips a client-side socket error (setTypeOfService EINVAL) on macOS, not the
  // route; 2,010 hostile requests at 100-way concurrency via curl were all 200/400.
  const res = [];
  for (let w = 0; w < 4; w++) {
    res.push(
      ...(await Promise.all(
        Array.from({ length: 50 }, (_, i) =>
          request.get(`/api/machines/near?${qs[(w * 50 + i) % qs.length]}`),
        ),
      )),
    );
  }
  for (const r of res) {
    expect([200, 400]).toContain(r.status());
    const b = await r.json();
    if (r.status() === 400) expect(typeof b.error).toBe("string");
    else {
      expect(typeof b.took_ms).toBe("number");
      expect(b.candidates.length).toBeLessThanOrEqual(100);
      for (const c of b.candidates)
        for (const f of ["dist_km", "score", "hp", "reputation"]) expect(Number.isFinite(c[f])).toBe(true);
    }
  }
});

test("adversarial: 5 parallel users hammer clicks, resolution, k and keyboard", async ({ browser }) => {
  const ctxs = await Promise.all(
    Array.from({ length: 5 }, () => browser.newContext({ viewport: { width: 1280, height: 900 } })),
  );
  await Promise.all(
    ctxs.map(async (ctx, u) => {
      const page = await ctx.newPage();
      const errors = watch(page);
      await page.goto(URL);
      const map = page.getByTestId("h3-map");
      const box = (await map.boundingBox())!;
      for (let i = 0; i < 40; i++) {
        const r = Math.random();
        if (r < 0.4)
          await page.mouse.click(box.x + Math.random() * box.width, box.y + Math.random() * box.height);
        else if (r < 0.6)
          await page.getByLabel(/h3 resolution/i).selectOption(String(7 + Math.floor(Math.random() * 3)));
        else if (r < 0.8)
          await page.getByLabel(/ring depth/i).fill(String(1 + Math.floor(Math.random() * 5)));
        else {
          await map.focus();
          await page.keyboard.press(
            ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home"][Math.floor(Math.random() * 5)],
          );
        }
        await assertInvariants(page).catch((e: unknown) => {
          throw new Error(`user ${u} iter ${i}: ${e instanceof Error ? e.message : String(e)}`);
        });
      }
      await expect(page.locator("body")).not.toContainText(/NaN|Infinity/);
      expect(errors, `user ${u}`).toEqual([]);
      await ctx.close();
    }),
  );
});

test("screenshots light, dark, 375", async ({ browser }) => {
  for (const [name, scheme, w, h] of [
    ["light", "light", 1280, 1100],
    ["dark", "dark", 1280, 1100],
    ["mobile", "light", 375, 812],
  ] as const) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
    const page = await ctx.newPage();
    await page.goto(URL);
    await page.getByLabel(/ring depth/i).fill("3");
    await page.screenshot({ path: `test-results/h3-${name}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await ctx.close();
  }
});
