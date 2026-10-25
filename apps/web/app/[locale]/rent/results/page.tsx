import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ResultsView, type Page } from "@/components/rent/results-view";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import type { Locale } from "@/i18n/routing";
import { apiParams, filtersToQuery, hasPlace, parseFilters, presetRange, type Raw } from "@/lib/rent";
import { ApiError } from "@/server/http";
import { searchMachines } from "@/server/machines";
import { todayIst } from "@/server/pricing";
import { searchSchema } from "@/server/validation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "search" });
  return { title: t("cta"), robots: { index: false } };
}

export default async function ResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Raw>;
}) {
  const { locale } = await params;
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- next/root-params needs Next 16; this is the Next 15 API
  setRequestLocale(locale as Locale);
  const today = todayIst();
  const f = parseFilters(await searchParams, today);
  // No place → back to the form; no dates → tomorrow (so every card can show a bookable range).
  if (!hasPlace(f)) redirect(`/${locale}/rent?${filtersToQuery(f).toString()}`);
  if (!f.from || !f.to)
    redirect(
      `/${locale}/rent/results?${filtersToQuery({ ...f, ...presetRange("tomorrow", today) }).toString()}`,
    );

  const t = await getTranslations({ locale: locale as Locale });
  let data: Awaited<ReturnType<typeof searchMachines>>;
  try {
    const extra: Record<string, string> = f.view === "map" ? { map: "1" } : {};
    data = await searchMachines(searchSchema.parse(Object.fromEntries(apiParams(f, extra))));
  } catch (e) {
    if (e instanceof ApiError && e.code === "place_not_found")
      return (
        <div className="mx-auto max-w-app px-4 py-8 sm:px-6">
          <EmptyState
            title={t("errors.api.place_not_found")}
            actions={
              <ButtonLink href={`/rent?${filtersToQuery(f).toString()}`}>{t("results.change")}</ButtonLink>
            }
          />
        </div>
      );
    throw e;
  }
  const page: Page = {
    items: data.items,
    total: data.total,
    freeTotal: data.freeTotal,
    nextCursor: data.nextCursor,
    place: data.place,
  };
  // Keyed by the query so a new filter starts the list afresh.
  return <ResultsView key={filtersToQuery(f).toString()} initial={page} filters={f} />;
}
