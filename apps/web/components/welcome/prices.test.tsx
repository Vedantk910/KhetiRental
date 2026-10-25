import { screen } from "@testing-library/react";
import { COMPONENTS } from "@/config/welcome";
import { renderIntl } from "@/lib/test-intl";
import { PriceLine, useParts } from "./prices";
import { BUY_RUPEES } from "./s2-bars";

function Lines() {
  return (
    <ul>
      {useParts().map((p) => (
        <li key={p.key}>
          {p.name}: <PriceLine part={p} />
        </li>
      ))}
    </ul>
  );
}

describe("S2 component prices", () => {
  it("keeps the typical market figures, and the tractor matches the buy-vs-rent bars", () => {
    expect(COMPONENTS.map((c) => [c.key, c.buy, c.rent, c.per])).toEqual([
      ["tractor", 640_000, 700, "hour"],
      ["rotavator", 110_000, 400, "hour"],
      ["plough", 35_000, 250, "hour"],
      ["seedDrill", 60_000, 300, "hour"],
      ["trolley", 150_000, 500, "day"],
    ]);
    expect(COMPONENTS[0].buy).toBe(BUY_RUPEES);
  });

  it("formats every component with Indian grouping and the unit", () => {
    renderIntl(<Lines />);
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual([
      "Tractor: Buy ₹6,40,000 · Rent ₹700 / hour",
      "Rotavator: Buy ₹1,10,000 · Rent ₹400 / hour",
      "Plough: Buy ₹35,000 · Rent ₹250 / hour",
      "Seed drill: Buy ₹60,000 · Rent ₹300 / hour",
      "Trolley: Buy ₹1,50,000 · Rent ₹500 / day",
    ]);
  });

  it("uses the language's own digits and names", () => {
    renderIntl(<Lines />, { locale: "mr" });
    expect(screen.getAllByRole("listitem")[1]).toHaveTextContent(
      "रोटाव्हेटर: विकत घ्या ₹१,१०,००० · भाडे ₹४०० / तास",
    );
  });
});
