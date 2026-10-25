import { helplineHref, whatsappHref } from "./contact";

it("links a real number and refuses a placeholder", () => {
  expect(helplineHref("+91 1800-000-000")).toBe("tel:+911800000000");
  expect(helplineHref("[YOUR HELPLINE]")).toBeNull();
  expect(helplineHref("javascript:alert(1)")).toBeNull();
});

it("builds a wa.me link from digits only, never from a placeholder", () => {
  expect(whatsappHref("+91 98765-43210")).toBe("https://wa.me/919876543210");
  expect(whatsappHref("[YOUR WHATSAPP]")).toBeNull();
  expect(whatsappHref("91987654321@evil.example/x")).toBeNull();
});
