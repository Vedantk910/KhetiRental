import { screen, within } from "@testing-library/react";
import { renderIntl } from "@/lib/test-intl";
import ProductDossier from "./page";
import { hourlyRate, netHourlyToOwner, paybackYears } from "@/lib/pricing-engine";

describe("Product dossier", () => {
  it("walks through all four ADRs", () => {
    renderIntl(<ProductDossier />);
    for (const id of ["ADR-0001", "ADR-0002", "ADR-0003", "ADR-0004"]) {
      expect(screen.getByRole("heading", { name: new RegExp(id) })).toBeInTheDocument();
    }
  });

  it("computes the payback table from the pricing engine", () => {
    renderIntl(<ProductDossier />);
    const table = screen.getByRole("table", { name: /payback/i });
    const rate = hourlyRate(
      { hp: "45", ageYears: 5, acquisitionCostInr: 640_000, soil: "loam", season: "harvest_compressed" },
      91,
    );
    for (const take of [0.12, 0.135, 0.15]) {
      for (const h of [250, 400, 620]) {
        const yrs = paybackYears(640_000, netHourlyToOwner(rate, take), h).toFixed(2);
        expect(within(table).getAllByText(yrs).length).toBeGreaterThan(0);
      }
    }
  });

  it("has no resume bullets, interview defence or team wording (D-16)", () => {
    renderIntl(<ProductDossier />);
    expect(screen.queryByRole("heading", { name: /resume|interview/i })).toBeNull();
    expect(document.body.textContent).not.toMatch(/resume|interview|track [ab]|lead \d|tarun|vedant/i);
  });
});
