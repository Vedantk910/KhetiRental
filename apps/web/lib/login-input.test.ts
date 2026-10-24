import fc from "fast-check";
import {
  displayPhone,
  groupMobile,
  mobileDigits,
  passwordStrength,
  validateLogin,
  type LoginValues,
} from "./login-input";

const base: LoginValues = {
  mode: "login",
  method: "mobile",
  name: "",
  mobile: "",
  email: "",
  password: "",
};

describe("mobileDigits", () => {
  it.each([
    ["98765 43210", "9876543210"],
    ["९८७६५ ४३२१०", "9876543210"],
    ["+91 98765-43210", "9876543210"],
    ["09876543210", "9876543210"],
    ["abc", ""],
  ])("%s → %s", (input, out) => {
    expect(mobileDigits(input)).toBe(out);
  });
  it("never returns more than 10 digits or a non-digit", () => {
    fc.assert(fc.property(fc.string({ maxLength: 40 }), (s) => /^\d{0,10}$/.test(mobileDigits(s))));
  });
  it("groups and displays", () => {
    expect(groupMobile("9876543210")).toBe("98765 43210");
    expect(displayPhone("+919876543210")).toBe("+91 98765 43210");
  });
});

describe("validateLogin", () => {
  it("mobile: needs a valid 10-digit Indian number", () => {
    expect(validateLogin(base)).toEqual({ mobile: "mobile" });
    expect(validateLogin({ ...base, mobile: "12345 67890" })).toEqual({ mobile: "mobile" });
    expect(validateLogin({ ...base, mobile: "९८७६५ ४३२१०" })).toEqual({});
  });
  it("sign-up needs a name of 2-80 characters", () => {
    expect(validateLogin({ ...base, mode: "signup", mobile: "9876543210" })).toEqual({ name: "name" });
    expect(validateLogin({ ...base, mode: "signup", mobile: "9876543210", name: " A " })).toEqual({
      name: "name",
    });
    expect(validateLogin({ ...base, mode: "signup", mobile: "9876543210", name: "Asha" })).toEqual({});
  });
  it("email: valid address, and 8+ characters only when signing up", () => {
    const e = { ...base, method: "email" as const, email: "a@b.in" };
    expect(validateLogin(e)).toEqual({ password: "passwordShort" });
    expect(validateLogin({ ...e, password: "x" })).toEqual({});
    expect(validateLogin({ ...e, mode: "signup", name: "Asha", password: "x" })).toEqual({
      password: "passwordShort",
    });
    expect(validateLogin({ ...e, mode: "signup", name: "Asha", password: "12345678" })).toEqual({});
    expect(validateLogin({ ...e, email: "nope", password: "x" })).toEqual({ email: "email" });
  });
  it("strength hint", () => {
    expect(passwordStrength("abc")).toBe("short");
    expect(passwordStrength("abcdefgh")).toBe("ok");
    expect(passwordStrength("abcdefgh1234")).toBe("strong");
  });
});
