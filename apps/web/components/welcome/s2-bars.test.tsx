import { renderIntl } from "@/lib/test-intl";
import { barWidth, BUY_RUPEES, RENT_RUPEES, S2Bars } from "./s2-bars";

describe("S2 buy-vs-rent bars", () => {
  it("draws the price gap honestly: buy is the full width, rent is its true share with a visible stub", () => {
    expect(barWidth(BUY_RUPEES)).toBe("max(12px, 100%)");
    expect(barWidth(RENT_RUPEES)).toBe(`max(12px, ${(RENT_RUPEES / BUY_RUPEES) * 100}%)`);
    expect(RENT_RUPEES / BUY_RUPEES).toBeLessThan(0.005);
  });

  it("renders both bars as draw-in bars; neither is a shrinking bar", () => {
    const { container } = renderIntl(<S2Bars />);
    const bars = container.querySelectorAll<HTMLElement>(".kr-grow");
    expect(bars).toHaveLength(2);
    expect(container.querySelector(".kr-shrink")).toBeNull();
    expect(bars[0].style.width).toBe(barWidth(BUY_RUPEES));
    expect(bars[1].style.width).toContain("12px");
    expect(container).toHaveTextContent("₹6,40,000");
    expect(container).toHaveTextContent("₹2,839");
  });
});
