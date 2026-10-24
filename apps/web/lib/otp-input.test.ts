import fc from "fast-check";
import { applyOtpInput, clock } from "./otp-input";

describe("applyOtpInput", () => {
  it("types a digit and moves to the next box", () => {
    expect(applyOtpInput("", 0, "4")).toEqual({ code: "4", focus: 1 });
    expect(applyOtpInput("12", 2, "3")).toEqual({ code: "123", focus: 3 });
  });
  it("a paste fills all six from the first box", () => {
    expect(applyOtpInput("", 0, "123456")).toEqual({ code: "123456", focus: 5 });
    expect(applyOtpInput("", 0, "12 34-56")).toEqual({ code: "123456", focus: 5 });
  });
  it("ignores extra digits and letters, accepts Devanagari", () => {
    expect(applyOtpInput("", 0, "1234567890").code).toBe("123456");
    expect(applyOtpInput("", 0, "a").code).toBe("");
    expect(applyOtpInput("", 0, "१२३").code).toBe("123");
  });
  it("clearing a box keeps the focus there", () => {
    expect(applyOtpInput("123456", 2, "")).toEqual({ code: "12 456", focus: 2 });
  });
  it("never yields more than six digits or a bad focus", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 8 }), fc.nat(5), fc.string({ maxLength: 20 }), (code, i, typed) => {
        const r = applyOtpInput(code.replace(/\D/g, "").slice(0, 6), i, typed);
        return r.code.length <= 6 && r.focus >= 0 && r.focus <= 5;
      }),
    );
  });
});

describe("clock", () => {
  it("formats the countdown", () => {
    expect(clock(30)).toBe("0:30");
    expect(clock(24)).toBe("0:24");
    expect(clock(0)).toBe("0:00");
    expect(clock(75)).toBe("1:15");
  });
});
