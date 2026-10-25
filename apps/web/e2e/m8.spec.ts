// M8 quality checks that are not per-page sweeps.
import { expect, test } from "@playwright/test";
import { contextFor, loadIds } from "./pages";
import { untilInteractive } from "./helpers";

test("owner wizard: a failed Next moves focus to the first field that needs fixing (A-06)", async ({
  browser,
}) => {
  const ctx = await contextFor(browser, "owner");
  const page = await ctx.newPage();
  await page.goto("/en/owner/machines/new");
  const next = page.getByRole("button", { name: "Next", exact: true });
  await untilInteractive(next);
  await next.click();
  const first = page.locator('main [aria-invalid="true"]').first();
  await expect(first).toBeVisible();
  await expect(first).toBeFocused();
  await ctx.close();
});

test("welcome page: description, canonical and language alternates (T-05)", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /^Find tractors, rotavators and harvesters for rent near your village\. See the full price before you book\./,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/en$/);
  for (const l of ["en", "hi", "mr"])
    await expect(page.locator(`link[rel="alternate"][hreflang="${l}"]`)).toHaveAttribute(
      "href",
      new RegExp(`/${l}$`),
    );
});

test("language switch keeps what was typed on the search form and the owner wizard", async ({ browser }) => {
  const renter = await contextFor(browser, "renter");
  const page = await renter.newPage();
  await page.goto("/en/rent");
  const place = page.getByRole("combobox");
  await untilInteractive(place);
  await place.fill("Latur");
  await page.locator("[data-lang-switch]:visible").first().locator('button[lang="hi"]').click();
  await expect(page).toHaveURL(/\/hi\/rent/);
  await expect(page.getByRole("combobox")).toHaveValue("Latur");
  await renter.close();

  const owner = await contextFor(browser, "owner");
  const wizard = await owner.newPage();
  await wizard.goto("/en/owner/machines/new");
  const make = wizard.getByLabel("Model");
  await untilInteractive(make);
  await make.fill("MU5501");
  await wizard.locator("[data-lang-switch]:visible").first().locator('button[lang="mr"]').click();
  await expect(wizard).toHaveURL(/\/mr\/owner\/machines\/new/);
  await expect(wizard.locator('input[value="MU5501"]')).toHaveCount(1);
  await owner.close();
});

test("language switch keeps what was typed in the problem report and the settings name", async ({
  browser,
}) => {
  const ids = await loadIds();
  const ctx = await contextFor(browser, "renter");
  const page = await ctx.newPage();
  await page.goto(`/en/bookings/${ids.booking}/problem`);
  const words = page.getByRole("textbox").first();
  await untilInteractive(words);
  await words.fill("The tractor came two hours late");
  await page.locator("[data-lang-switch]:visible").first().locator('button[lang="hi"]').click();
  await expect(page).toHaveURL(/\/hi\/bookings\/.*\/problem/);
  await expect(page.getByRole("textbox").first()).toHaveValue("The tractor came two hours late");

  await page.goto("/en/settings");
  const name = page.getByRole("textbox").first();
  await untilInteractive(name);
  await name.fill("Sunil Rao Changed");
  await page.locator("[data-lang-switch]:visible").first().locator('button[lang="mr"]').click();
  await expect(page).toHaveURL(/\/mr\/settings/);
  await expect(page.getByRole("textbox").first()).toHaveValue("Sunil Rao Changed");
  await ctx.close();
});
