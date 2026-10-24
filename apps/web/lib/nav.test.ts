import { isActive, isAppRoute, showFooter } from "./nav";

describe("nav helpers", () => {
  it.each([
    ["/rent", true],
    ["/rent/results", true],
    ["/bookings/KR-1", true],
    ["/owner", true],
    ["/notifications", true],
    ["/settings", true],
    ["/", false],
    ["/rental", false],
    ["/help", false],
    ["/dev/ui", false],
  ])("isAppRoute(%s) = %s", (p, v) => {
    expect(isAppRoute(p)).toBe(v);
  });

  it("isActive matches the section, not look-alike prefixes", () => {
    expect(isActive("/rent/m/4", "/rent")).toBe(true);
    expect(isActive("/rental", "/rent")).toBe(false);
    expect(isActive("/", "/rent")).toBe(false);
  });

  it("footer: public pages and the bottom of /rent only", () => {
    expect(showFooter("/")).toBe(true);
    expect(showFooter("/rent")).toBe(true);
    expect(showFooter("/rent/results")).toBe(false);
    expect(showFooter("/bookings")).toBe(false);
  });
});
