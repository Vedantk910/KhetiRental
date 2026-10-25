import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import en from "@/messages/en.json";
import hi from "@/messages/hi.json";
import mr from "@/messages/mr.json";
import { withEnglishFallback } from "@/i18n/messages";
import type { Locale } from "@/i18n/routing";

const all = {
  en,
  hi: withEnglishFallback(en, hi) as typeof en,
  mr: withEnglishFallback(en, mr) as typeof en,
};

export function renderIntl(
  ui: ReactElement,
  { locale = "en", ...opts }: RenderOptions & { locale?: Locale } = {},
) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale={locale} messages={all[locale]} timeZone="Asia/Kolkata">
      {children}
    </NextIntlClientProvider>
  );
  return render(ui, { wrapper: Wrapper, ...opts });
}
