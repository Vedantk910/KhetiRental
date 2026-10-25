import {
  emptyDraft,
  fitWithin,
  fromMachine,
  MAKES,
  sundaysBetween,
  toPayload,
  validateStep,
} from "./listing";

const NOW_YEAR = 2026;
const ok = {
  ...emptyDraft(),
  make: "swaraj",
  model: "744 FE",
  hp: "48",
  year: "2018",
  place: "413512 · Latur",
  pin: "413512",
  village: "Latur",
  lat: 18.4,
  lng: 76.5,
  price: "1400",
};

describe("validateStep", () => {
  it("step 1 needs company, model, a sensible HP (tractors only) and year", () => {
    expect(validateStep(1, ok, {}, NOW_YEAR)).toEqual({});
    const bad = { ...ok, make: "", model: "", hp: "9", year: "1900" };
    expect(Object.keys(validateStep(1, bad, {}, NOW_YEAR)).sort()).toEqual(["hp", "make", "model", "year"]);
    expect(validateStep(1, { ...ok, category: "rotavator", hp: "" }, {}, NOW_YEAR)).toEqual({});
    expect(validateStep(1, { ...ok, make: "other", makeOther: " " }, {}, NOW_YEAR)).toHaveProperty("make");
    expect(validateStep(1, { ...ok, model: "x".repeat(41) }, {}, NOW_YEAR)).toHaveProperty("model");
    expect(validateStep(1, { ...ok, year: "2027" }, {}, NOW_YEAR)).toHaveProperty("year");
  });
  it("step 2 needs the three photos", () => {
    const p = { preview: "x" };
    expect(validateStep(2, ok, {}, NOW_YEAR)).toHaveProperty("photos");
    expect(validateStep(2, ok, { front: p, side: p }, NOW_YEAR)).toHaveProperty("photos");
    expect(validateStep(2, ok, { front: p, side: p, meter: p }, NOW_YEAR)).toEqual({});
  });
  it("step 3 needs a place", () => {
    expect(validateStep(3, ok, {}, NOW_YEAR)).toEqual({});
    expect(validateStep(3, { ...ok, lat: null, lng: null }, {}, NOW_YEAR)).toHaveProperty("place");
  });
  it("step 4 takes whole rupees from 1 to 1,00,000, Devanagari digits included, nothing else", () => {
    expect(validateStep(4, ok, {}, NOW_YEAR)).toEqual({});
    expect(validateStep(4, { ...ok, price: "१४००" }, {}, NOW_YEAR)).toEqual({});
    for (const price of ["", "0", "-5", "1400.5", "100001", "1e9", "abc", "NaN", "Infinity"])
      expect(validateStep(4, { ...ok, price }, {}, NOW_YEAR), price).toHaveProperty("price");
  });
});

describe("toPayload / fromMachine", () => {
  it("builds exactly what the API accepts", () => {
    expect(toPayload(ok)).toEqual({
      category: "tractor",
      make: "Swaraj",
      model: "744 FE",
      hp: 48,
      year: 2018,
      hourMeter: null,
      lastServiced: null,
      attachments: [],
      lat: 18.4,
      lng: 76.5,
      village: "Latur",
      pin: "413512",
      priceUnit: "acre",
      priceRupees: 1400,
      operatorIncluded: true,
      dieselIncluded: true,
    });
    const other = toPayload({
      ...ok,
      category: "sprayer",
      make: "other",
      makeOther: "  Local Works ",
      lastServiced: "2025-06",
      hourMeter: "820",
    });
    expect(other).toMatchObject({
      hp: null,
      make: "Local Works",
      lastServiced: "2025-06-01",
      hourMeter: 820,
    });
  });
  it("round-trips a server machine", () => {
    const d = fromMachine({
      category: "tractor",
      make: "Mahindra",
      model: "575 DI",
      hp: 45,
      year: 2019,
      hourMeter: 1200,
      lastServiced: "2025-06-01",
      attachments: ["plough"],
      lat: 18.4,
      lng: 76.5,
      village: "Latur",
      pin: "413512",
      priceUnit: "hour",
      priceRupees: 750,
      operatorIncluded: false,
      dieselIncluded: true,
      blockedDays: ["2031-01-02"],
    });
    expect(d).toMatchObject({
      make: "mahindra",
      lastServiced: "2025-06",
      price: "750",
      unit: "hour",
      operator: false,
      blocked: ["2031-01-02"],
    });
    expect(
      fromMachine({
        ...{
          category: "tractor",
          make: "Zetor",
          model: "m",
          hp: 40,
          year: 2000,
          hourMeter: null,
          lastServiced: null,
          attachments: [],
          lat: 1,
          lng: 1,
          village: "V",
          pin: "413512",
          priceUnit: "day",
          priceRupees: 1,
          operatorIncluded: true,
          dieselIncluded: true,
          blockedDays: [],
        },
      }),
    ).toMatchObject({ make: "other", makeOther: "Zetor" });
    expect(MAKES).toContain("other");
  });
});

describe("helpers", () => {
  it("fitWithin shrinks the long side to the limit and never enlarges", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ w: 1600, h: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ w: 1200, h: 1600 });
    expect(fitWithin(800, 600, 1600)).toEqual({ w: 800, h: 600 });
  });
  it("sundaysBetween lists every Sunday in range, inclusive", () => {
    expect(sundaysBetween("2026-11-01", "2026-11-22")).toEqual([
      "2026-11-01",
      "2026-11-08",
      "2026-11-15",
      "2026-11-22",
    ]);
    expect(sundaysBetween("2026-11-02", "2026-11-07")).toEqual([]);
  });
});
