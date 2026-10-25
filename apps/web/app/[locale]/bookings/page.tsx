import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookingsList } from "@/components/rent/bookings-list";
import type { Locale } from "@/i18n/routing";
import type { Raw } from "@/lib/rent";
import { listBookings } from "@/server/bookings";
import { pageUser } from "@/server/page-user";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "bookings" });
  return { title: t("title"), robots: { index: false } };
}

export default async function BookingsPage({
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
  const sp = await searchParams;
  // This page is the renter's list; requests on a machine you own are in the owner dashboard.
  const items = (await listBookings(user)).filter((b) => b.role === "renter");
  const code = typeof sp.new === "string" ? sp.new.toUpperCase() : null;
  const fresh = code ? items.find((b) => b.code === code) : undefined;
  return (
    <BookingsList
      items={items}
      initialTab={sp.tab === "past" ? "past" : "upcoming"}
      newOwner={fresh ? (fresh.owner.name ?? "").split(/\s+/)[0] : null}
    />
  );
}
