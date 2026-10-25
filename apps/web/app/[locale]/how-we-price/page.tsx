import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ReadPage } from "@/components/pages/page-shell";
import { Card } from "@/components/ui/card";
import { PriceRow } from "@/components/ui/price-row";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { keepPaise } from "@/lib/domain";
import { formatRupees } from "@/lib/format";
import { quote } from "@/server/pricing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "price" });
  return { title: t("title") };
}

// The example runs the real quote() used at booking, so this page can't drift from the rules.
const SAMPLE = {
  category: "tractor",
  hp: 45,
  priceUnit: "hour",
  pricePaise: 70_000,
  dieselIncluded: true,
} as const;
const HOURS = 4;

const DEPOSIT_RULES = [1, 2, 3] as const;
const SOURCES = [1, 2, 3] as const;

export default async function HowWePricePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- next/root-params needs Next 16; this is the Next 15 API
  setRequestLocale(locale);
  const t = await getTranslations("price");
  const q = quote(SAMPLE, { days: 1, slot: "morning", qty: HOURS });
  const rs = (paise: number) => formatRupees(paise, locale);
  return (
    <ReadPage title={t("title")}>
      <p className="text-body text-text-muted">{t("lead")}</p>

      <section aria-labelledby="p-formula" className="flex flex-col gap-3">
        <h2 id="p-formula" className="text-h2">
          {t("formulaTitle")}
        </h2>
        <p className="text-body">{t("formula")}</p>
      </section>

      <section aria-labelledby="p-example" className="flex flex-col gap-3">
        <h2 id="p-example" className="text-h2">
          {t("exTitle")}
        </h2>
        <p className="text-body text-text-muted">
          {t("exIntro", { hp: SAMPLE.hp, rate: rs(SAMPLE.pricePaise), hours: HOURS })}
        </p>
        <Card variant="booking" className="flex flex-col gap-2">
          <PriceRow label={t("rent", { hours: HOURS, rate: rs(q.ratePaise) })} value={rs(q.rentPaise)} />
          <PriceRow
            label={t("diesel")}
            value={<span className="font-bold text-success">{t("included")}</span>}
          />
          <PriceRow label={t("deposit")} value={rs(q.depositPaise)} />
          <PriceRow label={t("youPay")} value={rs(q.totalPaise)} total />
        </Card>
      </section>

      <section aria-labelledby="p-deposit" className="flex flex-col gap-3">
        <h2 id="p-deposit" className="text-h2">
          {t("depositTitle")}
        </h2>
        <ul className="flex list-disc flex-col gap-2 pl-6 text-body">
          {DEPOSIT_RULES.map((n) => (
            <li key={n}>{t(`deposit${n}`)}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="p-fee" className="flex flex-col gap-3">
        <h2 id="p-fee" className="text-h2">
          {t("feeTitle")}
        </h2>
        <p className="text-body">{t("fee")}</p>
        <p className="text-body text-text-muted">
          {t("feeEx", { rent: rs(q.rentPaise), keep: rs(keepPaise(q.rentPaise)) })}
        </p>
      </section>

      <section aria-labelledby="p-rates" className="flex flex-col gap-3">
        <h2 id="p-rates" className="text-h2">
          {t("ratesTitle")}
        </h2>
        <p className="text-body">{t("rates")}</p>
        <h2 className="text-h2">{t("cancelTitle")}</h2>
        <p className="text-body">{t("cancel")}</p>
      </section>

      <section id="sources" aria-labelledby="p-sources" className="scroll-mt-20 flex flex-col gap-3">
        <h2 id="p-sources" className="text-h2">
          {t("sourcesTitle")}
        </h2>
        <p className="text-body text-text-muted">{t("sourcesIntro")}</p>
        <ul className="flex list-disc flex-col gap-2 pl-6 text-body">
          {SOURCES.map((n) => (
            <li key={n}>{t(`src${n}`)}</li>
          ))}
        </ul>
        <p className="text-small text-text-muted">{t("srcNote")}</p>
      </section>

      <p className="text-body">
        {t("more")}{" "}
        <Link href="/about/engineering" className="text-link underline underline-offset-4">
          {t("moreLink")}
        </Link>
      </p>
    </ReadPage>
  );
}
