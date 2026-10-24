import fc from "fast-check";
import {
  bookingCreateSchema,
  emailSchema,
  idempotencyKeySchema,
  machineCreateSchema,
  nameSchema,
  passwordSchema,
  phoneSchema,
  searchSchema,
} from "./validation";

describe("phoneSchema", () => {
  it.each([
    ["98765 43210", "+919876543210"],
    ["+91 98765-43210", "+919876543210"],
    ["०९८७६५४३२१०", "+919876543210"],
    ["9876543210", "+919876543210"],
  ])("%s → %s", (input, out) => {
    expect(phoneSchema.parse(input)).toBe(out);
  });
  it.each(["12345", "5876543210", "98765432101", "abc", "", "+1 9876543210"])("rejects %s", (bad) => {
    expect(phoneSchema.safeParse(bad).success).toBe(false);
  });
});

describe("email, password, name", () => {
  it("lower-cases and trims email", () => {
    expect(emailSchema.parse("  Asha@Example.COM ")).toBe("asha@example.com");
    expect(emailSchema.safeParse("nope").success).toBe(false);
  });
  it("password needs 8–128 characters", () => {
    expect(passwordSchema.safeParse("1234567").success).toBe(false);
    expect(passwordSchema.safeParse("12345678").success).toBe(true);
    expect(passwordSchema.safeParse("x".repeat(129)).success).toBe(false);
  });
  it("name is 2–80 characters after trimming", () => {
    expect(nameSchema.safeParse(" a ").success).toBe(false);
    expect(nameSchema.parse("  रमेश पाटील ")).toBe("रमेश पाटील");
    expect(nameSchema.safeParse("x".repeat(81)).success).toBe(false);
  });
});

describe("searchSchema (F-40: reject, don't silently clamp)", () => {
  it("applies defaults", () => {
    const q = searchSchema.parse({ pin: "413512" });
    expect(q).toMatchObject({ radiusKm: 10, sort: "nearest", slot: "full", limit: 20 });
  });
  it("accepts Devanagari digits in the PIN", () => {
    expect(searchSchema.parse({ pin: "४१३५१२" }).pin).toBe("413512");
  });
  it("needs a place", () => {
    expect(searchSchema.safeParse({}).success).toBe(false);
  });
  it.each([
    { pin: "413512", radius: "50" },
    { pin: "413512", limit: "1000" },
    { lat: "NaN", lng: "75" },
    { lat: "91", lng: "75" },
    { lat: "Infinity", lng: "75" },
    { pin: "41351" },
    { pin: "413512", from: "2026-11-04", to: "2026-11-02" },
    { pin: "413512", from: "2026-11-02" },
    { pin: "413512", from: "2026-11-01", to: "2027-01-01" },
    { pin: "413512", sort: "random" },
    { pin: "413512", job: "'; drop table machines;--" },
    { village: "x".repeat(61) },
  ])("rejects %o", (bad) => {
    expect(searchSchema.safeParse(bad).success).toBe(false);
  });
  it("property: never throws on arbitrary strings", () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.constantFrom("pin", "lat", "lng", "radius", "limit", "from", "to", "cursor"),
          fc.string(),
        ),
        (d) => {
          searchSchema.safeParse(d);
          return true;
        },
      ),
    );
  });
});

describe("bookingCreateSchema", () => {
  const ok = {
    machineId: "8e7c4c4e-0b1f-4a43-9d1a-3d3c9f0b1a11",
    startDate: "2026-11-02",
    endDate: "2026-11-04",
    slot: "full",
  };
  it("parses a valid body", () => {
    expect(bookingCreateSchema.parse(ok)).toMatchObject(ok);
  });
  it.each([
    { ...ok, machineId: "1 OR 1=1" },
    { ...ok, startDate: "2026-02-30" },
    { ...ok, endDate: "2026-11-01" },
    { ...ok, slot: "night" },
    { ...ok, qty: 1e308 },
    { ...ok, qty: Number.NaN },
    { ...ok, renterId: "someone-else" },
  ])("rejects %o", (bad) => {
    expect(bookingCreateSchema.safeParse(bad).success).toBe(false);
  });
  it("idempotency key: 8–100 url-safe characters", () => {
    expect(idempotencyKeySchema.safeParse("short").success).toBe(false);
    expect(idempotencyKeySchema.safeParse("a2c4e6g8-key").success).toBe(true);
    expect(idempotencyKeySchema.safeParse("bad key with spaces").success).toBe(false);
  });
});

describe("machineCreateSchema", () => {
  const ok = {
    category: "tractor",
    make: "Mahindra",
    model: "575 DI",
    hp: 45,
    year: 2019,
    attachments: ["rotavator"],
    lat: 18.4,
    lng: 76.57,
    village: "Latur",
    pin: "413512",
    priceUnit: "hour",
    priceRupees: 750,
    operatorIncluded: true,
    dieselIncluded: true,
  };
  it("parses and converts rupees to paise", () => {
    expect(machineCreateSchema.parse(ok).pricePaise).toBe(75_000);
  });
  it.each([
    { ...ok, priceRupees: -5 },
    { ...ok, priceRupees: 10_000_000 },
    { ...ok, priceRupees: 12.5 },
    { ...ok, attachments: ["jetpack"] },
    { ...ok, hp: 5000 },
    { ...ok, year: 1800 },
    { ...ok, lat: 200 },
    { ...ok, make: "" },
    { ...ok, isSample: true },
  ])("rejects %o", (bad) => {
    expect(machineCreateSchema.safeParse(bad).success).toBe(false);
  });
});
