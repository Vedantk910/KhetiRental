import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FLEET, fleetMachine, tierFromHp } from "./marketplace-fleet";
import {
  ACTIVITIES,
  ACTIVITY_SEASON,
  DEPOSIT_FLOOR_RATE,
  estimateHours,
  formatInr,
  quoteRental,
} from "./marketplace-quote";
import { hourlyRate } from "./pricing-engine";
import { createEscrow, DEPOSIT_RATE } from "./escrow-machine";

const machines = Object.values(FLEET);

describe("fleet", () => {
  it("looks machines up by id and returns undefined for strangers", () => {
    expect(fleetMachine("M-001")?.id).toBe("M-001");
    expect(fleetMachine("nope")).toBeUndefined();
    expect(fleetMachine("__proto__")).toBeUndefined();
    expect(fleetMachine("constructor")).toBeUndefined();
  });
  it("maps numeric HP to a pricing tier", () => {
    expect(tierFromHp(35)).toBe("35");
    expect(tierFromHp(75)).toBe("75_4wd");
    expect(tierFromHp(60)).toBeUndefined();
  });
});

describe("quoteRental", () => {
  it("maps crop activity to the season band", () => {
    expect(ACTIVITY_SEASON).toEqual({
      Plowing: "off_season",
      Sowing: "sowing",
      Harvesting: "harvest_compressed",
    });
  });
  it("takes the rate from the pricing engine and the 15 % deposit from the escrow machine", () => {
    const m = fleetMachine("M-001")!;
    const q = quoteRental(m, "Sowing", 8);
    const rate = hourlyRate(
      {
        hp: m.hp,
        ageYears: m.ageYears,
        acquisitionCostInr: m.acquisitionCostInr,
        soil: m.soil,
        season: "sowing",
      },
      91,
    );
    expect(q.hourlyRateInr).toBe(rate.total);
    const e = createEscrow({ hourlyRateInr: rate.total, contractedHours: 8, takeRate: 0.135 });
    expect(q.rentalPaise).toBe(e.basePaise);
    expect(q.depositPaise).toBeGreaterThanOrEqual(e.depositPaise);
  });
  it("applies the HP-tier floor when it beats 15 % of rental (contract section 5, 45 HP, 8 h sowing)", () => {
    const q = quoteRental(fleetMachine("M-002")!, "Sowing", 8);
    expect(q.depositRule).toBe("tier floor");
    expect(q.depositPaise).toBe(320_000);
  });
  it("uses 15 % on long rentals where it exceeds the floor", () => {
    const q = quoteRental(fleetMachine("M-002")!, "Harvesting", 100);
    expect(q.depositRule).toBe("15 % of rental");
    expect(q.depositPaise).toBeGreaterThan(320_000);
  });
  it("rejects bad hours", () => {
    for (const h of [0, -1, 1.5, NaN])
      expect(() => quoteRental(machines[0], "Sowing", h)).toThrow(RangeError);
  });
  it("property: total = rental + deposit, deposit >= 15 % and >= tier floor, never NaN", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...machines),
        fc.constantFrom(...ACTIVITIES),
        fc.integer({ min: 1, max: 720 }),
        (m, a, h) => {
          const q = quoteRental(m, a, h);
          const floor = Math.round(m.acquisitionCostInr * DEPOSIT_FLOOR_RATE * 100);
          expect(q.totalPaise).toBe(q.rentalPaise + q.depositPaise);
          expect(q.depositPaise).toBeGreaterThanOrEqual(Math.round(q.rentalPaise * DEPOSIT_RATE));
          expect(q.depositPaise).toBeGreaterThanOrEqual(floor);
          for (const n of [q.rentalPaise, q.depositPaise, q.totalPaise, q.hourlyRateInr])
            expect(Number.isFinite(n)).toBe(true);
          expect(Number.isInteger(q.totalPaise)).toBe(true);
        },
      ),
    );
  });
});

describe("helpers", () => {
  it("estimates whole hours from acres, at least one", () => {
    expect(estimateHours(0.1)).toBe(1);
    expect(estimateHours(8)).toBe(6);
    expect(estimateHours(NaN)).toBe(1);
  });
  it("formats paise with en-IN grouping", () => {
    expect(formatInr(123_456_700)).toBe("₹12,34,567");
    expect(formatInr(150)).toBe("₹1.50");
    expect(formatInr(NaN)).toBe("₹0");
  });
});
