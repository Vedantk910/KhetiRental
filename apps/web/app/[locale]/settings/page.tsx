import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SettingsView } from "@/components/settings/settings-view";
import type { Locale } from "@/i18n/routing";
import { pageUser } from "@/server/page-user";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "settings" });
  return { title: t("title"), robots: { index: false } };
}

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- next/root-params needs Next 16; this is the Next 15 API
  setRequestLocale(locale as Locale);
  const user = await pageUser();
  if (!user) notFound();
  return (
    <SettingsView
      name={user.name ?? ""}
      phone={user.phone}
      email={user.email}
      renter={user.roles.includes("renter")}
      owner={user.roles.includes("owner")}
      admin={user.roles.includes("admin")}
    />
  );
}
