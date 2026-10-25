import { fireEvent, render, screen } from "@testing-library/react";
import { PricingCalculator } from "./pricing-calculator";
import { hourlyRate } from "@/lib/pricing-engine";

const inr = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

describe("PricingCalculator", () => {
  it("shows the engine's rate for the defaults (45 HP, harvest, loam, 5 yr, ₹6.4 L, ₹91 diesel)", () => {
    render(<PricingCalculator />);
    const expected = hourlyRate(
      { hp: "45", ageYears: 5, acquisitionCostInr: 640_000, soil: "loam", season: "harvest_compressed" },
      91,
    ).total;
    expect(screen.getByTestId("hourly-rate")).toHaveTextContent(inr(expected));
  });

  it("recomputes when inputs change", () => {
    render(<PricingCalculator />);
    const before = screen.getByTestId("hourly-rate").textContent;
    fireEvent.change(screen.getByLabelText(/soil/i), { target: { value: "black_cotton" } });
    expect(screen.getByTestId("hourly-rate").textContent).not.toBe(before);
    fireEvent.change(screen.getByLabelText(/tractor age/i), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText(/horsepower/i), { target: { value: "75_4wd" } });
    expect(screen.getByTestId("hourly-rate")).toHaveTextContent("₹");
  });

  it("shows payback at 250 h and 620 h computed from the model, not a fixed claim", () => {
    render(<PricingCalculator />);
    const card = screen.getByTestId("payback");
    expect(card).toHaveTextContent("4.30 yr");
    expect(card).toHaveTextContent("1.73 yr");
  });

  it("labels the broker markup as an assumption and derives savings from it", () => {
    render(<PricingCalculator />);
    expect(screen.getByTestId("broker-savings")).toHaveTextContent("27.5%");
    expect(screen.getByText(/assumption/i)).toBeInTheDocument();
  });

  it("does not crash or show NaN on hostile input", () => {
    render(<PricingCalculator />);
    fireEvent.change(screen.getByLabelText(/diesel price/i), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(/diesel price/i), { target: { value: "-50" } });
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
  });

  it("T-07: a bad diesel price gets a plain message next to the field, never the engine's error text", () => {
    render(<PricingCalculator />);
    const before = screen.getByTestId("hourly-rate").textContent;
    const field = screen.getByLabelText(/diesel price/i);
    for (const bad of ["", "0", "5000", "-3"]) {
      fireEvent.change(field, { target: { value: bad } });
      expect(screen.getByText("Enter a diesel price between ₹1 and ₹1,000 a litre.")).toBeInTheDocument();
      expect(field).toHaveAttribute("aria-invalid", "true");
      expect(document.body.textContent).not.toMatch(/dieselPriceInr|finite number|got /);
      expect(screen.getByTestId("hourly-rate").textContent).toBe(before);
    }
    fireEvent.change(field, { target: { value: "95" } });
    expect(screen.queryByText(/Enter a diesel price/)).toBeNull();
  });
});
