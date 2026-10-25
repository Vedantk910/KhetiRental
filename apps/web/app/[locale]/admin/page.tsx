import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminPanel } from "@/components/admin/admin-panel";
import type { Locale } from "@/i18n/routing";
import { adminOverview } from "@/server/admin";
import { pageUser } from "@/server/page-user";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "admin" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- next/root-params needs Next 16; this is the Next 15 API
  setRequestLocale(locale as Locale);
  const user = await pageUser();
  if (!user) notFound();
  return <AdminPanel data={await adminOverview(user)} />;
}
