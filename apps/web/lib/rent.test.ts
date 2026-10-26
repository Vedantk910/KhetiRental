import fc from "fast-check";
import {
  apiParams,
  bookingOrigin,
  dayCount,
  estimateQty,
  filtersToQuery,
  fmtDays,
  monthGrid,
  parseFilters,
  pickDay,
  presetRange,
  whatsappLink,
} from "./rent";

const TODAY = "2026-11-01";

describe("parseFilters (everything in the URL is hostile)", () => {
  it("reads a full, well-formed query", () => {
    const f = parseFilters(
      {
        job: "rotavate",
        place: "413512",
        lat: "18.409",
        lng: "76.56",
        from: "2026-11-02",
        to: "2026-11-04",
        slot: "morning",
        acres: "2.5",
        r: "25",
        sort: "cheapest",
        driver: "1",
        view: "map",
      },
      TODAY,
    );
    expect(f).toEqual({
      job: "rotavate",
      place: "413512",
      lat: 18.409,
      lng: 76.56,
      from: "2026-11-02",
      to: "2026-11-04",
      slot: "morning",
      acres: 2.5,
      radius: 25,
      sort: "cheapest",
      driver: true,
      view: "map",
    });
  });
  it("falls back to safe defaults for junk", () => {
    const f = parseFilters(
      { job: "<script>", slot: "night", r: "9999", sort: "random", driver: "yes", view: "3d", acres: "-4" },
      TODAY,
    );
    expect(f).toMatchObject({
      job: null,
      slot: "full",
      radius: 10,
      sort: "nearest",
      driver: false,
      view: "list",
      acres: null,
    });
  });
  it("takes the first of repeated params, trims and caps the place", () => {
    expect(parseFilters({ place: ["  Latur ", "x"] }, TODAY).place).toBe("Latur");
    expect(parseFilters({ place: "x".repeat(500) }, TODAY).place).toHaveLength(60);
    expect(parseFilters({ place: "La\u0000tur\n" }, TODAY).place).toBe("Latur");
  });
  it("dates: both or neither, valid, not in the past, at most 30 days", () => {
    expect(parseFilters({ from: "2026-11-02" }, TODAY)).toMatchObject({ from: null, to: null });
    expect(parseFilters({ from: "2026-02-30", to: "2026-03-01" }, TODAY)).toMatchObject({ from: null });
    expect(parseFilters({ from: "2026-10-01", to: "2026-10-03" }, TODAY)).toMatchObject({ from: null });
    expect(parseFilters({ from: "2026-10-30", to: "2026-11-03" }, TODAY)).toMatchObject({
      from: "2026-11-01",
      to: "2026-11-03",
    });
    expect(parseFilters({ from: "2026-11-05", to: "2026-11-02" }, TODAY)).toMatchObject({
      from: "2026-11-05",
      to: "2026-11-05",
    });
    expect(parseFilters({ from: "2026-11-02", to: "2027-11-02" }, TODAY)).toMatchObject({
      to: "2026-12-01",
    });
  });
  it("coordinates: finite and in range, or dropped together; acres 0.5–100 in half steps, Devanagari ok", () => {
    expect(parseFilters({ lat: "91", lng: "10" }, TODAY)).toMatchObject({ lat: null, lng: null });
    expect(parseFilters({ lat: "NaN", lng: "10" }, TODAY)).toMatchObject({ lat: null, lng: null });
    expect(parseFilters({ lat: "10" }, TODAY)).toMatchObject({ lat: null, lng: null });
    expect(parseFilters({ acres: "२.५" }, TODAY).acres).toBe(2.5);
    expect(parseFilters({ acres: "1e9" }, TODAY).acres).toBeNull();
    expect(parseFilters({ acres: "100000" }, TODAY).acres).toBe(100);
    expect(parseFilters({ acres: "0.1" }, TODAY).acres).toBe(0.5);
    expect(parseFilters({ acres: "2.3" }, TODAY).acres).toBe(2.5);
  });
  it("never throws and always yields values the API will accept (property)", () => {
    const junk = fc.dictionary(
      fc.constantFrom(
        "job",
        "place",
        "lat",
        "lng",
        "from",
        "to",
        "slot",
        "acres",
        "r",
        "sort",
        "driver",
        "view",
      ),
      fc.oneof(fc.string({ maxLength: 80 }), fc.array(fc.string({ maxLength: 10 }), { maxLength: 3 })),
    );
    fc.assert(
      fc.property(junk, (raw) => {
        const f = parseFilters(raw, TODAY);
        expect([5, 10, 25]).toContain(f.radius);
        expect(["list", "map"]).toContain(f.view);
        if (f.from) {
          expect(f.from >= TODAY).toBe(true);
          expect(f.to! >= f.from).toBe(true);
          expect(dayCount(f.from, f.to!)).toBeLessThanOrEqual(30);
        }
        // round trip: the query we write parses back to the same filters
        const again = parseFilters(Object.fromEntries(filtersToQuery(f)), TODAY);
        expect(again).toEqual(f);
      }),
      { numRuns: 300 },
    );
  });
});

describe("filtersToQuery / apiParams", () => {
  const base = parseFilters({ job: "sow", place: "413512", from: "2026-11-02", to: "2026-11-02" }, TODAY);
  it("writes every value into the URL (F-37), omitting what is empty", () => {
    const q = filtersToQuery({ ...base, acres: 2.5 });
    expect(q.toString()).toBe(
      "job=sow&place=413512&from=2026-11-02&to=2026-11-02&slot=full&acres=2.5&r=10&sort=nearest",
    );
    expect(filtersToQuery({ ...base, driver: true, view: "map" }).toString()).toMatch(/driver=1&view=map$/);
  });
  it("API: a PIN goes as pin, a typed village as village, GPS wins when the label is not a PIN", () => {
    expect(apiParams(base).get("pin")).toBe("413512");
    expect(apiParams({ ...base, place: "Latur" }).get("village")).toBe("Latur");
    const gps = apiParams({ ...base, place: "Near you (Chakur)", lat: 18.5, lng: 76.9 });
    expect([gps.get("lat"), gps.get("lng"), gps.get("village")]).toEqual(["18.5", "76.9", null]);
    expect(apiParams(base).get("radius")).toBe("10");
    expect(apiParams({ ...base, driver: true }).get("driver")).toBe("1");
  });
});

describe("dates", () => {
  it("presets: tomorrow is one day, this week is the next 7 days", () => {
    expect(presetRange("tomorrow", TODAY)).toEqual({ from: "2026-11-02", to: "2026-11-02" });
    expect(presetRange("week", TODAY)).toEqual({ from: "2026-11-02", to: "2026-11-08" });
  });
  it("counts days inclusively and formats the count", () => {
    expect(dayCount("2026-11-02", "2026-11-04")).toBe(3);
    expect(fmtDays("2026-11-02", "2026-11-04", "en")).toMatch(/Mon 2 Nov\s–\sWed 4 Nov/);
    expect(fmtDays("2026-11-02", "2026-11-02", "en")).toBe("Mon 2 Nov");
  });
  it("pickDay: first tap sets the start, second the end; earlier or too-far taps restart", () => {
    const a = pickDay(null, "2026-11-05", false, () => false);
    expect(a).toEqual({ range: { from: "2026-11-05", to: "2026-11-05" }, endNext: true });
    const b = pickDay(a.range, "2026-11-07", a.endNext, () => false);
    expect(b).toEqual({ range: { from: "2026-11-05", to: "2026-11-07" }, endNext: false });
    expect(pickDay(a.range, "2026-11-03", true, () => false).range).toEqual({
      from: "2026-11-03",
      to: "2026-11-03",
    });
    expect(pickDay(a.range, "2026-12-30", true, () => false).range.from).toBe("2026-12-30");
    // a busy day in the middle restarts at the tapped day
    expect(pickDay(a.range, "2026-11-07", true, (d) => d === "2026-11-06").range.from).toBe("2026-11-07");
  });
  it("monthGrid pads to Sunday-first weeks", () => {
    const g = monthGrid("2026-11");
    expect(g.length % 7).toBe(0);
    expect(g.filter(Boolean)).toHaveLength(30);
    expect(g[0]).toBe("2026-11-01"); // a Sunday: no padding before it
    expect(monthGrid("2026-12")[0]).toBeNull(); // 1 Dec is a Tuesday
  });
});

describe("estimates and links", () => {
  it("estimateQty: hours from acres × 0.75 in half steps, else 4", () => {
    expect(estimateQty("hour", 2.5, 1, "full")).toBe(2);
    expect(estimateQty("hour", null, 1, "full")).toBe(4);
    expect(estimateQty("hour", 100, 1, "morning")).toBe(6); // capped by the slot
    expect(estimateQty("acre", 2.5, 1, "full")).toBe(2.5);
    expect(estimateQty("acre", null, 1, "full")).toBe(1);
    expect(estimateQty("day", 3, 2, "full")).toBe(2);
  });
  it("whatsappLink strips the phone to digits and encodes the text", () => {
    expect(whatsappLink("+919800000001", "Hi & bye")).toBe("https://wa.me/919800000001?text=Hi%20%26%20bye");
    expect(whatsappLink("+91 98000-00001", "x")).toMatch(/wa\.me\/919800000001/);
  });
});

describe("bookingOrigin", () => {
  const f = (raw: Parameters<typeof parseFilters>[0]) => parseFilters(raw, TODAY);
  it("names the place the same way the search did: PIN, then GPS, then village", () => {
    expect(bookingOrigin(f({ place: "413512" }))).toEqual({ pin: "413512" });
    expect(bookingOrigin(f({ place: "Latur", lat: "18.4", lng: "76.5" }))).toEqual({ lat: 18.4, lng: 76.5 });
    expect(bookingOrigin(f({ place: "Latur" }))).toEqual({ village: "Latur" });
    expect(bookingOrigin(f({ place: "413512", lat: "18.4", lng: "76.5" }))).toEqual({ pin: "413512" });
  });
  it("is undefined with no place, and never carries anything else", () => {
    expect(bookingOrigin(f({}))).toBeUndefined();
    expect(bookingOrigin(f({ place: "Latur", job: "sow", acres: "3" }))).toEqual({ village: "Latur" });
  });
});
