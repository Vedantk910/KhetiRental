import fc from "fast-check";
import { PRICE_UNITS, SLOTS } from "@/lib/domain";
import {
  bayesianRating,
  bookingWindow,
  cancelDeadline,
  depositFloorPaise,
  quote,
  roundKm,
  type PricedMachine,
} from "./pricing";

const tractor = (over: Partial<PricedMachine> = {}): PricedMachine => ({
  category: "tractor",
  hp: 35,
  priceUnit: "hour",
  pricePaise: 71_000,
  dieselIncluded: true,
  ...over,
});

describe("bookingWindow (IST slots, F-06/F-26)", () => {
  it("full day runs 7 am – 7 pm India time across the whole range", () => {
    const w = bookingWindow("2026-11-02", "2026-11-04", "full");
    expect(w.start.toISOString()).toBe("2026-11-02T01:30:00.000Z");
    expect(w.end.toISOString()).toBe("2026-11-04T13:30:00.000Z");
    expect(w.days).toBe(3);
  });
  it("morning is 7 am – 1 pm and afternoon 1 – 7 pm", () => {
    const m = bookingWindow("2026-11-02", "2026-11-02", "morning");
    const a = bookingWindow("2026-11-02", "2026-11-02", "afternoon");
    expect(m.end.getTime()).toBe(a.start.getTime());
    expect((m.end.getTime() - m.start.getTime()) / 3.6e6).toBe(6);
  });
  it("rejects an end before the start and impossible dates", () => {
    expect(() => bookingWindow("2026-11-04", "2026-11-02", "full")).toThrow();
    expect(() => bookingWindow("2026-02-30", "2026-03-01", "full")).toThrow();
  });
});

describe("cancelDeadline", () => {
  it("is 24 h before the start", () => {
    const w = bookingWindow("2026-11-02", "2026-11-02", "full");
    expect(cancelDeadline(w.start).toISOString()).toBe("2026-11-01T01:30:00.000Z");
  });
});

describe("depositFloorPaise", () => {
  it("follows the HP tier for tractors", () => {
    expect(depositFloorPaise({ category: "tractor", hp: 35 })).toBe(195_000);
    expect(depositFloorPaise({ category: "tractor", hp: 45 })).toBe(320_000);
    expect(depositFloorPaise({ category: "tractor", hp: 50 })).toBe(490_000);
    expect(depositFloorPaise({ category: "tractor", hp: 75 })).toBe(860_000);
  });
  it("has a category floor for implements", () => {
    expect(depositFloorPaise({ category: "sprayer", hp: null })).toBeGreaterThan(0);
  });
});

describe("quote (UI-SPEC §4.7.2, F-15)", () => {
  it("short job (< 8 h): deposit = min(tier floor, 25 % of rent)", () => {
    const q = quote(tractor(), { days: 1, slot: "full", qty: 4 });
    expect(q.rentPaise).toBe(284_000);
    expect(q.depositPaise).toBe(71_000); // 25 % of 2,840 < 1,950 floor
    expect(q.totalPaise).toBe(284_000);
  });
  it("short job with a big rent caps at the floor", () => {
    const q = quote(tractor({ pricePaise: 400_000 }), { days: 1, slot: "full", qty: 4 });
    expect(q.depositPaise).toBe(195_000);
  });
  it("long job (≥ 8 h): deposit = max(15 % of rent, floor)", () => {
    const q = quote(tractor(), { days: 2, slot: "full", qty: 20 });
    expect(q.rentPaise).toBe(1_420_000);
    expect(q.depositPaise).toBe(213_000);
    const small = quote(tractor({ pricePaise: 10_000 }), { days: 1, slot: "full", qty: 8 });
    expect(small.depositPaise).toBe(195_000);
  });
  it("per day: qty is the day count, half-day slots count half", () => {
    const m = tractor({ priceUnit: "day", pricePaise: 300_000 });
    expect(quote(m, { days: 3, slot: "full" }).qty).toBe(3);
    expect(quote(m, { days: 3, slot: "morning" }).qty).toBe(1.5);
    expect(quote(m, { days: 3, slot: "full" }).rentPaise).toBe(900_000);
  });
  it("per acre uses 0.75 h per acre for the deposit rule", () => {
    const m = tractor({ priceUnit: "acre", pricePaise: 140_000 });
    expect(quote(m, { days: 1, slot: "full", qty: 10 }).depositPaise).toBe(195_000); // 7.5 h → min(1,950, 3,500)
    expect(quote(m, { days: 1, slot: "full", qty: 11 }).depositPaise).toBe(231_000); // 8.25 h → max(2,310, 1,950)
  });
  it("hours cannot exceed what the slot allows", () => {
    expect(() => quote(tractor(), { days: 1, slot: "morning", qty: 7 })).toThrow(/qty/);
    expect(() => quote(tractor(), { days: 1, slot: "full", qty: 0 })).toThrow(/qty/);
    expect(() => quote(tractor(), { days: 1, slot: "full", qty: 0.3 })).toThrow(/qty/);
  });
  it("defaults the estimate when none is given", () => {
    expect(quote(tractor(), { days: 2, slot: "full" }).qty).toBe(8);
    expect(quote(tractor({ priceUnit: "acre" }), { days: 1, slot: "full" }).qty).toBe(1);
  });
  it("property: money is whole rupees, non-negative, and total = rent", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...PRICE_UNITS),
        fc.integer({ min: 1, max: 20_000 }),
        fc.integer({ min: 1, max: 30 }),
        fc.constantFrom(...SLOTS),
        fc.integer({ min: 15, max: 120 }),
        (unit, rupees, days, slot, hp) => {
          const q = quote(tractor({ priceUnit: unit, pricePaise: rupees * 100, hp }), { days, slot });
          return (
            q.rentPaise % 100 === 0 &&
            q.depositPaise % 100 === 0 &&
            q.depositPaise >= 0 &&
            q.totalPaise === q.rentPaise
          );
        },
      ),
    );
  });
});

describe("bayesianRating (F-18)", () => {
  it("pulls small samples to the prior 4.2 with C = 5", () => {
    expect(bayesianRating(0, 0)).toBeCloseTo(4.2);
    expect(bayesianRating(5, 1)).toBeCloseTo((5 * 4.2 + 5) / 6);
  });
  it("40 reviews at 4.7 beat 1 review at 5.0", () => {
    expect(bayesianRating(4.7 * 40, 40)).toBeGreaterThan(bayesianRating(5, 1));
  });
});

describe("roundKm (S-07)", () => {
  it("rounds to the nearest 0.5 km", () => {
    expect(roundKm(1.24)).toBe(1);
    expect(roundKm(1.26)).toBe(1.5);
    expect(roundKm(9.9)).toBe(10);
  });
});
