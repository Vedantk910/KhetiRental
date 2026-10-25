import { SUPPORT_PHONE } from "@/config/site";
import { helplineHref, whatsappHref } from "./contact";

it("builds tel: and wa.me links from the number's digits only", () => {
  expect(helplineHref("+91 1800-000-000")).toBe("tel:+911800000000");
  expect(whatsappHref("+91 98765-43210")).toBe("https://wa.me/919876543210");
  expect(whatsappHref("91987654321@evil.example/x")).toBe("https://wa.me/91987654321");
});

it("the configured support number becomes the two links", () => {
  expect(helplineHref()).toBe("tel:+917821900000");
  expect(whatsappHref()).toBe("https://wa.me/917821900000");
  expect(SUPPORT_PHONE).toBe("+91 78219 00000");
});
