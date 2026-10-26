// The listing wizard keeps its draft on the server (UI-SPEC §4.11): carry on from another phone, photos included,
// and it is gone once the machine is published.
import { expect, test, type Page } from "@playwright/test";
import { freshIp, signUp, sql, watchHealth } from "./auth-helpers";
import { checkLayout, untilInteractive } from "./helpers";
import { MESSAGES } from "./messages";

const m = MESSAGES.en;
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const png = (name: string) => ({ name, mimeType: "image/png", buffer: PNG });
const next = (page: Page) => page.locator("[data-sticky-cta] button");

const draftOf = (phone: string) =>
  sql(
    (s) => s<{ step: number; data: { model?: string }; photos: Record<string, string> }[]>`
    SELECT d.step, d.data, d.photos FROM listing_drafts d JOIN users u ON u.id = d.owner_id WHERE u.phone = ${phone}`,
  ).then((r) => r.at(0));

test("a half-finished listing follows the owner to another phone, and publishing removes the draft", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const owner = await signUp(browser, "Ramesh Draft", "owner");
  const { page } = owner;
  const health = watchHealth(owner.ctx);
  const model = `D${Date.now() % 1e7}`;

  await page.goto("/en/owner/machines/new?step=1");
  const company = page.getByLabel(m.list.company, { exact: true });
  await untilInteractive(company);
  await company.selectOption("swaraj");
  await page.getByLabel(m.list.model, { exact: true }).fill(model);
  await page.getByLabel(m.list.hp, { exact: true }).fill("48");
  await page.getByLabel(m.list.year, { exact: true }).fill("2018");
  await next(page).click();
  await expect(page).toHaveURL(/step=2/);
  // The step change saved at once.
  await expect.poll(async () => (await draftOf(owner.phone))?.step).toBe(2);
  expect((await draftOf(owner.phone))?.data.model).toBe(model);

  for (const slot of ["front", "side", "meter"])
    await page.getByTestId(`photo-${slot}-gallery`).setInputFiles(png(`${slot}.png`));
  await expect
    .poll(async () => Object.keys((await draftOf(owner.phone))?.photos ?? {}).sort())
    .toEqual(["front", "meter", "side"]);
  const uploaded = (await draftOf(owner.phone))!.photos;

  // Another phone: same account, nothing in its browser storage.
  const phone2 = await browser.newContext({
    storageState: await owner.ctx.storageState(),
    extraHTTPHeaders: { "x-forwarded-for": freshIp() },
    viewport: { width: 390, height: 844 },
  });
  const p2 = await phone2.newPage();
  await p2.goto("/en/owner/machines/new");
  await expect(p2.getByRole("heading", { level: 1 })).toHaveText(m.list.s2);
  await expect(
    p2.getByRole("img", { name: m.list.photoOf.replace("{slot}", m.list.slotFront) }),
  ).toBeVisible();
  await expect
    .poll(() =>
      p2.locator("main img").evaluateAll((els) => els.every((e) => (e as HTMLImageElement).naturalWidth > 0)),
    )
    .toBe(true);
  await checkLayout(p2, "restored photos step", true);
  await p2.getByRole("button", { name: m.list.back }).click();
  await expect(p2.getByLabel(m.list.model, { exact: true })).toHaveValue(model);
  await expect(p2.getByLabel(m.list.hp, { exact: true })).toHaveValue("48");
  expect(await p2.evaluate(() => localStorage.getItem("kr:listing-draft:v1"))).not.toBeNull(); // the offline copy

  // Finish there.
  await next(p2).click();
  await next(p2).click();
  await p2.getByRole("combobox").fill("413512");
  await p2.getByRole("option").first().click();
  await next(p2).click();
  await expect(p2).toHaveURL(/step=4/);
  await p2.locator("input[inputmode=numeric]").fill("1400");
  await next(p2).click();
  await expect(p2).toHaveURL(/\/en\/owner$/);

  const [listed] = await sql(
    (s) => s<{ id: string; active: boolean; urls: string[] }[]>`
    SELECT m.id, m.active, array_agg(p.url ORDER BY p.kind) AS urls
    FROM machines m JOIN machine_photos p ON p.machine_id = m.id WHERE m.model = ${model} GROUP BY m.id`,
  );
  expect(listed.active).toBe(true);
  // The very files uploaded to the draft are now the machine's photos.
  expect([...listed.urls].sort()).toEqual(Object.values(uploaded).sort());
  expect(await draftOf(owner.phone)).toBeUndefined();
  expect(await p2.evaluate(() => localStorage.getItem("kr:listing-draft:v1"))).toBeNull();
  // A fresh wizard is empty again.
  await p2.goto("/en/owner/machines/new?step=1");
  await expect(p2.getByLabel(m.list.model, { exact: true })).toHaveValue("");
  expect(health).toEqual([]);
  await phone2.close();
  await owner.ctx.close();
});

test("with the server unreachable the phone keeps the draft and sends it when the network is back", async ({
  browser,
}) => {
  const owner = await signUp(browser, "Ramesh Offline", "owner");
  const { page } = owner;
  const model = `O${Date.now() % 1e7}`;
  await page.route("**/api/owner/draft**", (r) => r.abort());
  await page.goto("/en/owner/machines/new?step=1");
  const field = page.getByLabel(m.list.model, { exact: true });
  await untilInteractive(field);
  await field.fill(model);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("kr:listing-draft:v1"))).toContain(model);
  expect(await draftOf(owner.phone)).toBeUndefined();

  await page.unroute("**/api/owner/draft**");
  await page.reload();
  await expect(page.getByLabel(m.list.model, { exact: true })).toHaveValue(model);
  await expect.poll(async () => (await draftOf(owner.phone))?.data.model).toBe(model);
  await owner.ctx.close();
});

test("another owner sees nothing of a draft or its photos", async ({ browser }) => {
  const a = await signUp(browser, "Ramesh Ek", "owner");
  const b = await signUp(browser, "Suresh Do", "owner");
  await a.page.goto("/en/owner/machines/new?step=2");
  await a.page.getByTestId("photo-front-gallery").setInputFiles(png("front.png"));
  await expect.poll(async () => (await draftOf(a.phone))?.photos.front).toBeTruthy();
  const url = (await draftOf(a.phone))!.photos.front;
  expect((await a.ctx.request.get(url)).status()).toBe(200);
  expect((await b.ctx.request.get(url)).status()).toBe(404);
  expect(await (await b.ctx.request.get("/api/owner/draft")).json()).toEqual({ draft: null });
  await b.page.goto("/en/owner/machines/new");
  await expect(b.page.getByRole("heading", { level: 1 })).toHaveText(m.list.s1);
  await a.ctx.close();
  await b.ctx.close();
});
