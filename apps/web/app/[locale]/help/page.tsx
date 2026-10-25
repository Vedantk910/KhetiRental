import { ChevronDown } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ReadPage } from "@/components/pages/page-shell";
import { ButtonLink } from "@/components/ui/button";
import { buttonClass } from "@/components/ui/button-class";
import { Card } from "@/components/ui/card";
import { config } from "@/config/site";
import type { Locale } from "@/i18n/routing";
import { helplineHref, whatsappHref } from "@/lib/contact";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "help" });
  return { title: t("title") };
}

const FAQ = [1, 2, 3, 4, 5, 6] as const;

export default async function HelpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- next/root-params needs Next 16; this is the Next 15 API
  setRequestLocale(locale as Locale);
  const t = await getTranslations("help");
  return (
    <ReadPage title={t("title")}>
      <p className="text-body text-text-muted">{t("intro")}</p>
      <Card as="section" className="flex flex-col gap-3" aria-labelledby="help-contact">
        <h2 id="help-contact" className="sr-only">
          {t("callCard")}
        </h2>
        <a href={helplineHref()} className={buttonClass("primary", "lg", "w-full")}>
          {t("call", { phone: config.helplinePhone })}
        </a>
        <a href={whatsappHref()} className={buttonClass("secondary", "lg", "w-full")}>
          {t("whatsapp", { phone: config.whatsappPhone })}
        </a>
        <p className="text-caption text-text-subtle">{t("hours")}</p>
      </Card>
      <section aria-labelledby="help-faq" className="flex flex-col gap-3">
        <h2 id="help-faq" className="text-h2">
          {t("faq")}
        </h2>
        {FAQ.map((n) => (
          <details key={n} className="group rounded-card border border-border-subtle bg-surface">
            <summary className="flex min-h-tap-lg cursor-pointer list-none items-center justify-between gap-3 rounded-card px-4 py-2 text-label [&::-webkit-details-marker]:hidden">
              {t(`q${n}`)}
              <ChevronDown
                aria-hidden
                className="h-6 w-6 shrink-0 transition-transform group-open:rotate-180"
              />
            </summary>
            <p className="px-4 pb-4 text-body text-text-muted">{t(`a${n}`)}</p>
          </details>
        ))}
      </section>
      <Card as="section" className="flex flex-col gap-3" aria-labelledby="help-report">
        <h2 id="help-report" className="text-h3">
          {t("report")}
        </h2>
        <p className="text-body text-text-muted">{t("reportBody")}</p>
        <ButtonLink href="/bookings" variant="secondary" prefetch={false}>
          {t("reportGo")}
        </ButtonLink>
      </Card>
    </ReadPage>
  );
}
