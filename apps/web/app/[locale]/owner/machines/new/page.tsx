import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { OwnerMode } from "@/components/owner/owner-mode";
import { Wizard } from "@/components/owner/wizard";
import type { Locale } from "@/i18n/routing";
import type { Raw } from "@/lib/rent";
import { pageUser } from "@/server/page-user";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "list" });
  return { title: t("titleNew"), robots: { index: false } };
}

export default async function NewMachinePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Raw>;
}) {
  const { locale } = await params;
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- next/root-params needs Next 16; this is the Next 15 API
  setRequestLocale(locale as Locale);
  const user = await pageUser();
  if (!user) notFound();
  if (!user.roles.includes("owner") && !user.roles.includes("admin")) return <OwnerMode />;
  const raw = (await searchParams).step;
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return <Wizard initialStep={n >= 1 && n <= 4 && Number.isInteger(n) ? (n as 1 | 2 | 3 | 4) : null} />;
}
