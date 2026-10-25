import { helplineHref } from "./contact";

it("links a real number and refuses a placeholder", () => {
  expect(helplineHref("+91 1800-000-000")).toBe("tel:+911800000000");
  expect(helplineHref("[YOUR HELPLINE]")).toBeNull();
  expect(helplineHref("javascript:alert(1)")).toBeNull();
});
