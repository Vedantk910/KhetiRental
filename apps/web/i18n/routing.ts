import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["mr", "hi", "en"],
  defaultLocale: "en",
  // Remember an explicit choice for a year (D-03); first visits use Accept-Language.
  localeCookie: { name: "NEXT_LOCALE", maxAge: 60 * 60 * 24 * 365 },
});

export type Locale = (typeof routing.locales)[number];
