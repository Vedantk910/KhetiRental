import { render, screen } from "@testing-library/react";
import { BarList, barPercent } from "./bar-list";

describe("barPercent", () => {
  it("linear: value over max, clamped", () => {
    expect(barPercent(50, 200, "linear")).toBe(25);
    expect(barPercent(300, 200, "linear")).toBe(100);
    expect(barPercent(-1, 200, "linear")).toBe(0);
  });
  it("log: decades between min and max", () => {
    expect(barPercent(1, 1000, "log", 0.1)).toBeCloseTo(100 / 4, 5); // 1 decade of 4
    expect(barPercent(1000, 1000, "log", 0.1)).toBe(100);
    expect(barPercent(0.01, 1000, "log", 0.1)).toBe(0);
  });
});

describe("BarList", () => {
  it("draws one bar per row with its text value and an accessible summary", () => {
    render(
      <BarList
        label="Rates"
        max={100}
        bars={[
          { label: "A", value: 50, text: "₹50", tone: "success" },
          { label: "B", value: 100, text: "₹100", tone: "muted" },
        ]}
      />,
    );
    expect(screen.getByRole("img", { name: "Rates: A ₹50, B ₹100" })).toBeInTheDocument();
    const bars = document.querySelectorAll("[data-bar]");
    expect(bars).toHaveLength(2);
    expect((bars[0] as HTMLElement).style.inlineSize).toBe("50%");
  });
});
