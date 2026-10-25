import { decide, postLoginPath, requiredAccess, safeNext } from "./access";

describe("requiredAccess (UI-SPEC §3.1)", () => {
  it.each([
    ["/", "public"],
    ["/login", "public"],
    ["/help", "public"],
    ["/how-we-price", "public"],
    ["/about/engineering/systems", "public"],
    ["/settings/anything", "user"],
    ["/rent", "user"],
    ["/rent/m/abc/book", "user"],
    ["/bookings/KR-1234", "user"],
    ["/notifications", "user"],
    ["/settings", "user"],
    ["/owner/machines/new", "user"],
    ["/owner", "owner"],
    ["/owner/requests/KR-1", "owner"],
    ["/admin", "admin"],
    ["/renting", "public"],
  ])("%s → %s", (path, access) => {
    expect(requiredAccess(path)).toBe(access);
  });
});

describe("decide", () => {
  it("logged out → login; wrong role → forbidden; admins pass owner pages", () => {
    expect(decide("public", null)).toBe("allow");
    expect(decide("user", null)).toBe("login");
    expect(decide("owner", ["renter"])).toBe("forbidden");
    expect(decide("owner", ["owner"])).toBe("allow");
    expect(decide("owner", ["admin"])).toBe("allow");
    expect(decide("admin", ["owner", "renter"])).toBe("forbidden");
  });
});

describe("safeNext (no open redirects)", () => {
  it.each([
    ["/en/rent?x=1", "/en/rent?x=1"],
    ["https://evil.example", null],
    ["//evil.example", null],
    ["/\\evil.example", null],
    ["javascript:alert(1)", null],
    [null, null],
  ])("%s → %s", (next, out) => {
    expect(safeNext(next)).toBe(out);
  });
});

describe("postLoginPath (UI-SPEC §3.3)", () => {
  it("next wins; owner-only → /owner; new owner sign-up → listing wizard; else /rent", () => {
    expect(postLoginPath("en", ["renter"], "/en/bookings")).toBe("/en/bookings");
    expect(postLoginPath("mr", ["owner"], null)).toBe("/mr/owner");
    expect(postLoginPath("hi", ["renter", "owner"], null)).toBe("/hi/rent");
    expect(postLoginPath("en", ["owner"], null, true)).toBe("/en/owner/machines/new");
  });
});

describe("postLoginPath after login (UI-SPEC §3.3)", () => {
  it("next wins; owner-only → /owner; everyone else → /rent; new owner sign-up → listing wizard", () => {
    expect(postLoginPath("hi", ["renter"], "/hi/bookings")).toBe("/hi/bookings");
    expect(postLoginPath("hi", ["owner"], "https://evil.example")).toBe("/hi/owner");
    expect(postLoginPath("en", ["owner", "renter"], null)).toBe("/en/rent");
    expect(postLoginPath("en", ["renter"], null)).toBe("/en/rent");
    expect(postLoginPath("mr", ["owner"], null, true)).toBe("/mr/owner/machines/new");
    expect(postLoginPath("mr", ["owner"], "/mr/owner/requests/KR-1", true)).toBe("/mr/owner/requests/KR-1");
  });
});
