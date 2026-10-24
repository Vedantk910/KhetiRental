import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Gallery } from "@/components/dev/gallery";
import type { Locale } from "@/i18n/routing";
import { devUiEnabled } from "@/lib/dev-ui";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "dev" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function DevUiPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- next/root-params needs Next 16; this is the Next 15 API
  setRequestLocale(locale as Locale);
  await connection(); // read ENABLE_DEV_UI at request time, not at build time
  if (!devUiEnabled()) notFound();
  return <Gallery />;
}
