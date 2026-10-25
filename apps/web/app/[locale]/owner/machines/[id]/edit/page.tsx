import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Wizard, type EditMachine } from "@/components/owner/wizard";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { Locale } from "@/i18n/routing";
import { ApiError, uuidParam } from "@/server/http";
import { pageUser } from "@/server/page-user";
import { getMyMachine } from "@/server/owner";
import type { Raw } from "@/lib/rent";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "list" });
  return { title: t("titleEdit"), robots: { index: false } };
}

export default async function EditMachinePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<Raw>;
}) {
  const { locale, id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- next/root-params needs Next 16; this is the Next 15 API
  setRequestLocale(locale as Locale);
  const user = await pageUser();
  if (!user) notFound();
  try {
    const m = (await getMyMachine(user, uuidParam(id))) as EditMachine;
    const raw = (await searchParams).step;
    const n = Number(Array.isArray(raw) ? raw[0] : raw);
    return (
      <Wizard machine={m} initialStep={n >= 1 && n <= 4 && Number.isInteger(n) ? (n as 1 | 2 | 3 | 4) : 1} />
    );
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 404) throw e;
    const t = await getTranslations({ locale: locale as Locale, namespace: "owner" });
    return (
      <div className="mx-auto max-w-app px-4 py-8 sm:px-6">
        <h1 className="sr-only">{t("notFound")}</h1>
        <EmptyState
          title={t("notFound")}
          actions={<ButtonLink href="/owner">{t("backToDashboard")}</ButtonLink>}
        />
      </div>
    );
  }
}
