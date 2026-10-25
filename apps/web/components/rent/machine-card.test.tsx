import { screen } from "@testing-library/react";
import { renderIntl } from "@/lib/test-intl";
import { MachineCard, type CardItem } from "./machine-card";

const item = (id: string, name: string, village: string): CardItem => ({
  id,
  name,
  category: "tractor",
  attachments: [],
  hp: 45,
  priceRupees: 700,
  unit: "hour",
  operatorIncluded: false,
  distanceKm: 4,
  village,
  rating: null,
  reviewCount: 0,
  ownerShortName: "Ramesh P.",
  servicedMonth: null,
  photoUrl: null,
  available: true,
  nextFreeDate: null,
  isSample: false,
});

// REVIEW A-04: two cards must not both offer an identical "Book for 10–11 Jan".
describe("MachineCard book link", () => {
  it("names the machine, keeps the visible text first, and differs per card", () => {
    renderIntl(
      <>
        <MachineCard m={item("a", "Swaraj 744", "Ausa")} qs="" from="2030-01-10" to="2030-01-11" />
        <MachineCard m={item("b", "Mahindra 575", "Latur")} qs="" from="2030-01-10" to="2030-01-11" />
      </>,
    );
    const names = screen.getAllByRole("link", { name: /^Book for/ }).map((a) => a.getAttribute("aria-label"));
    expect(names).toHaveLength(2);
    expect(new Set(names).size).toBe(2);
    for (const n of names) expect(n).toMatch(/^Book for 10.11 Jan, /);
  });
});
