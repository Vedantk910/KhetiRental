import fc from "fast-check";
import { formatDateRange, formatRupees, toAsciiNumber } from "./format";

const DEVA = "०१२३४५६७८९";
const toDeva = (s: string) => s.replace(/\d/g, (d) => DEVA[Number(d)]);
const digitsOnly = (s: string) => s.replace(/[०-९]/g, (d) => String(DEVA.indexOf(d))).replace(/[^\d-]/g, "");

describe("toAsciiNumber", () => {
  it.each([
    ["710", 710],
    ["७१०", 710],
    ["२,५", 2.5],
    ["2,5", 2.5],
    ["2.5", 2.5],
    [" 12 ", 12],
    ["-3", -3],
    ["०.५", 0.5],
  ])("%s → %s", (s, n) => {
    expect(toAsciiNumber(s)).toBe(n);
  });

  it.each(["", " ", "abc", "1.2.3", "1,2,3", "1,2.3", "--1", "१a", "Infinity", "NaN", "1e3", "0x10", "."])(
    "%j → NaN",
    (s) => {
      expect(toAsciiNumber(s)).toBeNaN();
    },
  );

  it("round-trips any non-negative decimal written in ASCII or Devanagari, with a dot or comma", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }),
        fc.integer({ min: 0, max: 99 }),
        fc.boolean(),
        fc.boolean(),
        (w, f, deva, comma) => {
          const s = f === 0 ? String(w) : `${w}${comma ? "," : "."}${String(f).padStart(2, "0")}`;
          const n = toAsciiNumber(deva ? toDeva(s) : s);
          expect(Number.isNaN(n)).toBe(false);
          expect(n).toBeCloseTo(w + f / 100, 6);
        },
      ),
    );
  });

  it("never throws on arbitrary input", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(typeof toAsciiNumber(s)).toBe("number");
      }),
    );
  });
});

describe("formatRupees", () => {
  it("shows whole rupees with Indian grouping", () => {
    expect(formatRupees(71_000, "en")).toBe("₹710");
    expect(formatRupees(12_345_678_00, "en")).toBe("₹1,23,45,678");
    expect(formatRupees(71_049, "en")).toBe("₹710");
    expect(formatRupees(71_050, "en")).toBe("₹711");
  });

  it("uses each locale's own digits via Intl", () => {
    expect(formatRupees(71_000, "hi")).toBe("₹710");
    expect(formatRupees(71_000, "mr")).toBe("₹७१०");
    expect(formatRupees(123_456_700, "mr")).toBe("₹१२,३४,५६७");
  });

  it("round-trips: parsing the digits back gives the rounded rupee amount, never NaN", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000_00 }),
        fc.constantFrom<"en" | "hi" | "mr">("en", "hi", "mr"),
        (paise, l) => {
          const out = formatRupees(paise, l);
          const back = toAsciiNumber(digitsOnly(out));
          expect(back).toBe(Math.round(paise / 100));
        },
      ),
    );
  });
});

describe("formatDateRange", () => {
  const d = (s: string) => new Date(`${s}T00:00:00+05:30`);
  it("formats a range like the mockups", () => {
    expect(formatDateRange(d("2026-11-02"), d("2026-11-04"), "en")).toBe("Mon 2 Nov – Wed 4 Nov");
  });
  it("collapses a single day", () => {
    expect(formatDateRange(d("2026-11-02"), d("2026-11-02"), "en")).toBe("Mon 2 Nov");
  });
  it("is in India time regardless of the machine's zone", () => {
    expect(formatDateRange(new Date("2026-11-01T20:00:00Z"), new Date("2026-11-03T20:00:00Z"), "en")).toBe(
      "Mon 2 Nov – Wed 4 Nov",
    );
  });
  it("localises names and digits", () => {
    const hi = formatDateRange(d("2026-11-02"), d("2026-11-04"), "hi");
    const mr = formatDateRange(d("2026-11-02"), d("2026-11-04"), "mr");
    expect(hi).toContain("नव॰");
    expect(mr).toMatch(/[०-९]/);
    expect(hi).toContain(" – ");
  });
});
