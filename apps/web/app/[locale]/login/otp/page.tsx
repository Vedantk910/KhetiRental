import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { OtpForm } from "@/components/auth/otp-form";
import type { Locale } from "@/i18n/routing";
import { redirectIfSignedIn } from "@/server/page-user";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "otp" });
  return { title: t("title"), robots: { index: false } };
}

export default async function OtpPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const { next } = await searchParams;
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- next/root-params needs Next 16; this is the Next 15 API
  setRequestLocale(locale as Locale);
  await redirectIfSignedIn(locale, next ?? null);
  return <OtpForm next={next ?? null} />;
}
