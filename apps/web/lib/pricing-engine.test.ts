import { readFileSync } from "node:fs";
import path from "node:path";
import fc from "fast-check";
import {
  BASE_RATE_BY_HP,
  HP_TIERS,
  SEASONS,
  SOILS,
  brokerComparison,
  hourlyRate,
  netHourlyToOwner,
  paybackYears,
  type MachineInput,
} from "./pricing-engine";

const m45: MachineInput = {
  hp: "45",
  ageYears: 5,
  acquisitionCostInr: 640_000,
  soil: "loam",
  season: "harvest_compressed",
};

describe("hourlyRate", () => {
  it("applies R = B·μ·δ + D·κ + F·P exactly", () => {
    const r = hourlyRate(m45, 91);
    expect(r.base).toBeCloseTo(420 * 1.45 * 1.0, 2);
    expect(r.wear).toBeCloseTo((640_000 / 10_000) * (1 + 0.05 * 5), 2);
    expect(r.fuel).toBeCloseTo(4.0 * 91, 2);
    expect(r.total).toBeCloseTo(r.base + r.wear + r.fuel, 2);
  });

  // Integration with the Python model: the TS port must reproduce the
  // committed analytics report to the paisa, or the two have drifted.
  it("matches showcase/analytics/results/pricing_report.json for the reference fleet", () => {
    const report = JSON.parse(
      readFileSync(
        path.resolve(__dirname, "../../../showcase/analytics/results/pricing_report.json"),
        "utf8",
      ),
    );
    const fleet: Record<string, MachineInput> = {
      "M-101": {
        hp: "45",
        ageYears: 5,
        acquisitionCostInr: 640_000,
        soil: "loam",
        season: "harvest_compressed",
      },
      "M-102": {
        hp: "75_4wd",
        ageYears: 9,
        acquisitionCostInr: 1_720_000,
        soil: "black_cotton",
        season: "harvest_compressed",
      },
      "M-103": { hp: "55", ageYears: 11, acquisitionCostInr: 980_000, soil: "sandy", season: "sowing" },
      "M-104": { hp: "35", ageYears: 2, acquisitionCostInr: 390_000, soil: "loam", season: "off_season" },
    };
    for (const item of report.items) {
      const r = hourlyRate(fleet[item.machine_id], report.diesel_price_inr);
      expect([r.base, r.wear, r.fuel, r.total]).toEqual([
        item.base_component,
        item.wear_component,
        item.fuel_component,
        item.hourly_rate_inr,
      ]);
    }
    const uc = report.utilization_expansion_case;
    const net = netHourlyToOwner(hourlyRate(fleet["M-101"], report.diesel_price_inr));
    expect(net).toBe(uc.net_hourly_to_owner_inr);
    expect(Number(paybackYears(640_000, net, 250).toFixed(2))).toBe(uc.payback_at_250h);
    expect(Number(paybackYears(640_000, net, 620).toFixed(2))).toBe(uc.payback_at_620h);
  });

  it.each([
    ["unknown HP tier", { ...m45, hp: "999" }],
    ["unknown soil", { ...m45, soil: "lava" }],
    ["unknown season", { ...m45, season: "monsoon" }],
    ["negative age", { ...m45, ageYears: -1 }],
    ["NaN age", { ...m45, ageYears: Number.NaN }],
    ["absurd age", { ...m45, ageYears: 200 }],
    ["zero acquisition cost", { ...m45, acquisitionCostInr: 0 }],
    ["Infinity acquisition cost", { ...m45, acquisitionCostInr: Number.POSITIVE_INFINITY }],
  ])("rejects %s", (_, bad) => {
    expect(() => hourlyRate(bad as MachineInput, 91)).toThrow();
  });

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])("rejects diesel price %s", (p) => {
    expect(() => hourlyRate(m45, p)).toThrow();
  });
});

describe("owner economics", () => {
  it("net to owner excludes the fuel pass-through and the take-rate", () => {
    const r = hourlyRate(m45, 91);
    expect(netHourlyToOwner(r, 0.135)).toBeCloseTo((r.total - r.fuel) * 0.865, 2);
  });

  it("rejects take-rates outside the 12-15 % policy band", () => {
    const r = hourlyRate(m45, 91);
    expect(() => netHourlyToOwner(r, 0.2)).toThrow();
    expect(() => netHourlyToOwner(r, 0.1)).toThrow();
  });

  it("payback is cost / (net × hours) and Infinity with no revenue", () => {
    expect(paybackYears(600_000, 1_000, 300)).toBeCloseTo(2, 6);
    expect(paybackYears(600_000, 0, 300)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("brokerComparison", () => {
  it("a 38 % broker markup saves the farmer 1 - 1/1.38 ≈ 27.5 %, not 38 %", () => {
    const c = brokerComparison(1000, 0.38);
    expect(c.brokerRate).toBeCloseTo(1380, 6);
    expect(c.farmerSavingsPct).toBeCloseTo(27.536, 2);
  });
});

// Property tests: thousands of random machines from every tier/soil/season.
describe("properties", () => {
  const machine = fc.record({
    hp: fc.constantFrom(...HP_TIERS),
    ageYears: fc.integer({ min: 0, max: 40 }),
    acquisitionCostInr: fc.integer({ min: 100_000, max: 5_000_000 }),
    soil: fc.constantFrom(...SOILS),
    season: fc.constantFrom(...SEASONS),
  });
  const diesel = fc.double({ min: 50, max: 200, noNaN: true });

  it("total is always finite, positive and ≥ base rate", () => {
    fc.assert(
      fc.property(machine, diesel, (mm, p) => {
        const r = hourlyRate(mm, p);
        return Number.isFinite(r.total) && r.total >= BASE_RATE_BY_HP[mm.hp] * 0.9;
      }),
    );
  });

  it("older machines never price lower, all else equal", () => {
    fc.assert(
      fc.property(
        machine,
        diesel,
        (mm, p) =>
          hourlyRate({ ...mm, ageYears: Math.min(mm.ageYears + 1, 40) }, p).total >= hourlyRate(mm, p).total,
      ),
    );
  });

  it("surge never lowers the price", () => {
    fc.assert(
      fc.property(
        machine,
        diesel,
        (mm, p) =>
          hourlyRate({ ...mm, season: "harvest_compressed" }, p).total >=
          hourlyRate({ ...mm, season: "off_season" }, p).total,
      ),
    );
  });
});
