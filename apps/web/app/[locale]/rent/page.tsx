import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SearchForm } from "@/components/rent/search-form";
import type { Locale } from "@/i18n/routing";
import { parseFilters, type Raw } from "@/lib/rent";
import { todayIst } from "@/server/pricing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "search" });
  return { title: t("what"), robots: { index: false } };
}

/** The last search, remembered in a cookie (UI-SPEC §4.4); a URL's own values win. */
function remembered(raw: string | undefined): Raw {
  try {
    const j = JSON.parse(decodeURIComponent(raw ?? "")) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(j)
        .filter(([, v]) => typeof v === "string" || typeof v === "number")
        .map(([k, v]) => [k, String(v)]),
    );
  } catch {
    return {};
  }
}

export default async function RentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Raw>;
}) {
  const { locale } = await params;
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- next/root-params needs Next 16; this is the Next 15 API
  setRequestLocale(locale as Locale);
  const q = await searchParams;
  const today = todayIst();
  const fromUrl = Object.keys(q).length > 0;
  const last = fromUrl ? {} : remembered((await cookies()).get("kr_last_search")?.value);
  return <SearchForm initial={parseFilters({ ...last, ...q }, today)} today={today} />;
}
