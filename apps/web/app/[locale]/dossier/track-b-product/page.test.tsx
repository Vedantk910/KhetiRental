import { render, screen, within } from "@testing-library/react";
import ProductDossier from "./page";
import { RESUME_BULLETS } from "@/lib/evidence";
import { hourlyRate, netHourlyToOwner, paybackYears } from "@/lib/pricing-engine";

describe("Product dossier", () => {
  it("walks through all four ADRs", () => {
    render(<ProductDossier />);
    for (const id of ["ADR-0001", "ADR-0002", "ADR-0003", "ADR-0004"]) {
      expect(screen.getByRole("heading", { name: new RegExp(id) })).toBeInTheDocument();
    }
  });

  it("computes the payback table from the pricing engine", () => {
    render(<ProductDossier />);
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

  it("carries the resume bullets and an interview defence", () => {
    render(<ProductDossier />);
    for (const b of RESUME_BULLETS.product) expect(screen.getByText(b)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /interview defence/i })).toBeInTheDocument();
  });

  it("never mentions the team work split", () => {
    render(<ProductDossier />);
    expect(document.body.textContent).not.toMatch(/track [ab]|lead \d|tarun|vedant/i);
  });
});
