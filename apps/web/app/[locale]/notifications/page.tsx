import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { NotificationsList } from "@/components/rent/notifications-list";
import type { Locale } from "@/i18n/routing";
import { listNotifications } from "@/server/notifications";
import { pageUser } from "@/server/page-user";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "notif" });
  return { title: t("title"), robots: { index: false } };
}

export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- next/root-params needs Next 16; this is the Next 15 API
  setRequestLocale(locale as Locale);
  const user = await pageUser();
  if (!user) notFound();
  const { items } = await listNotifications(user);
  return (
    <NotificationsList
      items={items.map((i) => ({
        id: i.id,
        type: i.type,
        code: i.code,
        readAt: i.readAt ? new Date(i.readAt).toISOString() : null,
        createdAt: new Date(i.createdAt).toISOString(),
      }))}
    />
  );
}
