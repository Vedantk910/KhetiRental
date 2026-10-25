import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import en from "../messages/en.json";
import { withEnglishFallback } from "./messages";

// eslint-disable-next-line @typescript-eslint/no-deprecated -- next/root-params needs Next 16; this is the Next 15 API
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const own = ((await import(`../messages/${locale}.json`)) as { default: typeof en }).default;
  const messages = withEnglishFallback(en, own) as typeof en;
  return { locale, timeZone: "Asia/Kolkata", messages };
});
