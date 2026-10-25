import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MachineDetailView } from "@/components/rent/machine-detail";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { Locale } from "@/i18n/routing";
import { filtersToQuery, parseFilters, type Raw } from "@/lib/rent";
import { loadMachine } from "@/server/rent-pages";
import { todayIst } from "@/server/pricing";

export const metadata: Metadata = { robots: { index: false } };

export default async function MachinePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<Raw>;
}) {
  const { locale, id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- next/root-params needs Next 16; this is the Next 15 API
  setRequestLocale(locale as Locale);
  const today = todayIst();
  const f = parseFilters(await searchParams, today);
  const m = await loadMachine(id, f);
  if (!m) {
    const t = await getTranslations({ locale: locale as Locale, namespace: "detail" });
    return (
      <div className="mx-auto max-w-app px-4 py-8 sm:px-6">
        <EmptyState
          title={t("unavailable")}
          actions={
            <ButtonLink href={`/rent/results?${filtersToQuery(f).toString()}`}>
              {t("backToResults")}
            </ButtonLink>
          }
        />
      </div>
    );
  }
  return <MachineDetailView m={m} filters={f} today={today} />;
}
