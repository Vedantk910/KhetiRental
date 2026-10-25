import type { Metadata, Viewport } from "next";
import { Baloo_2, Mukta } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/shell/site-footer";
import { SiteHeader } from "@/components/shell/site-header";
import { SkipLink } from "@/components/shell/skip-link";
import { TabBar } from "@/components/shell/tab-bar";
import { ToastProvider } from "@/components/ui/toast";
import { routing } from "@/i18n/routing";
import { MOTION_SCRIPT } from "@/lib/motion";
import { THEME_SCRIPT } from "@/lib/theme";

// Latin is preloaded; Devanagari (~130 kB for both weights) is fetched only when a Hindi or Marathi
// character is on the page, so English pages do not wait for it on a slow link.
const ui = Mukta({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-ui",
  display: "swap",
});
const uiDevanagari = Mukta({
  subsets: ["devanagari"],
  weight: ["400", "700"],
  variable: "--font-ui-deva",
  display: "swap",
  preload: false,
});
const display = Baloo_2({
  subsets: ["latin", "devanagari"],
  weight: ["700"],
  variable: "--font-display",
  display: "swap",
  preload: false,
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "common" });
  return {
    // Only used to turn relative metadata URLs (canonical, language alternates) into absolute ones.
    metadataBase: new URL(process.env.SITE_URL || "http://localhost:3000"),
    title: { default: t("brand"), template: `%s – ${t("brand")}` },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- next/root-params needs Next 16; this is the Next 15 API
  setRequestLocale(locale);
  return (
    <html
      lang={locale}
      className={`${ui.variable} ${uiDevanagari.variable} ${display.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Sets data-motion before first paint, so nothing flashes (UI-SPEC §4.1.5). */}
        <script dangerouslySetInnerHTML={{ __html: MOTION_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col overflow-x-hidden font-ui antialiased">
        <NextIntlClientProvider>
          <ToastProvider>
            <SkipLink />
            <SiteHeader />
            <main id="main" tabIndex={-1} className="flex-1 outline-none">
              {children}
            </main>
            <SiteFooter />
            <TabBar />
          </ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
