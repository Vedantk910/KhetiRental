import { messageForApi, messageForSignIn } from "./auth-client-messages";

describe("messageForSignIn", () => {
  it("counts the tries left", () => {
    expect(messageForSignIn("otp_wrong_3")).toEqual({ key: "otp.wrong", n: 3 });
    expect(messageForSignIn("otp_wrong_1")).toEqual({ key: "otp.wrong", n: 1 });
  });
  it.each([
    ["rate_limited", "login.err.rate"],
    ["otp_expired", "otp.expired"],
    ["otp_locked", "errors.api.otp_locked"],
    ["credentials", "login.err.creds"],
    [undefined, "login.err.creds"],
  ])("%s → %s", (code, key) => {
    expect(messageForSignIn(code).key).toBe(key);
  });
  it("a missing name means an unknown number when logging in", () => {
    expect(messageForSignIn("invalid_request", "login").key).toBe("otp.noAccount");
    expect(messageForSignIn("invalid_request", "signup").key).toBe("errors.api.invalid_request");
  });
});

describe("messageForApi", () => {
  it("maps rate limits and resend waits, anything else is the network message", () => {
    expect(messageForApi("rate_limited").key).toBe("login.err.rate");
    expect(messageForApi("otp_resend_wait").key).toBe("errors.api.otp_resend_wait");
    expect(messageForApi(undefined).key).toBe("errors.network");
  });
});
