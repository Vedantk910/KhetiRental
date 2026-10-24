import fc from "fast-check";
import { easeOutCubic, formatCount, progressAt } from "./counter";

describe("counter easing", () => {
  it("starts at 0, ends at 1, never decreases", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (a, b) => {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          return easeOutCubic(lo) <= easeOutCubic(hi);
        },
      ),
    );
  });
  it("is ease-out: more than half done at half time", () => {
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875);
  });
  it("clamps progress", () => {
    expect(progressAt(-5, 1800)).toBe(0);
    expect(progressAt(900, 1800)).toBe(0.5);
    expect(progressAt(99_999, 1800)).toBe(1);
  });
});

describe("formatCount", () => {
  it("starts at 0 and finishes on exactly the target", () => {
    expect(formatCount(86, 0, 0, "%", "en")).toBe("0%");
    expect(formatCount(86, 1, 0, "%", "en")).toBe("86%");
    expect(formatCount(1.08, 0, 2, "", "en")).toBe("0.00");
    expect(formatCount(1.08, 1, 2, "", "en")).toBe("1.08");
    expect(formatCount(47, 1, 0, "%", "hi")).toBe("47%");
  });
  it("uses Devanagari digits in Marathi", () => {
    expect(formatCount(47, 1, 0, "%", "mr")).toBe("४७%");
  });
  it("never overshoots the target", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (p) => {
        return Number(formatCount(86, p, 0, "", "en")) <= 86;
      }),
    );
  });
});
