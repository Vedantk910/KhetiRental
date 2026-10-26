import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmailConfirm } from "@/components/settings/email-confirm";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "settings" });
  return { title: t("emailPageTitle"), robots: { index: false } };
}

export default async function EmailConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  const { token } = await searchParams;
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- next/root-params needs Next 16; this is the Next 15 API
  setRequestLocale(locale as Locale);
  return <EmailConfirm token={typeof token === "string" ? token : ""} />;
}
