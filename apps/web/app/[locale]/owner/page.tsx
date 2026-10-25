import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Dashboard } from "@/components/owner/dashboard";
import type { MyMachine } from "@/components/owner/machines-list";
import type { Locale } from "@/i18n/routing";
import { listBookings } from "@/server/bookings";
import { listMyMachines } from "@/server/machines";
import { ownerCalendar, ownerEarnings } from "@/server/owner";
import { pageUser } from "@/server/page-user";
import { todayIst } from "@/server/pricing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "owner" });
  return { title: t("title"), robots: { index: false } };
}

export default async function OwnerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- next/root-params needs Next 16; this is the Next 15 API
  setRequestLocale(locale as Locale);
  const user = await pageUser();
  if (!user) notFound();
  const today = todayIst();
  // listBookings first: it closes requests whose 2 hours ran out.
  const bookings = await listBookings(user);
  const rows = await listMyMachines(user);
  const machines: MyMachine[] = rows.map((r) => ({
    id: String(r.id),
    name: `${String(r.make)} ${String(r.model)}`,
    priceUnit: r.priceUnit as MyMachine["priceUnit"],
    priceRupees: Number(r.priceRupees),
    active: Boolean(r.active),
    rcStatus: r.rcStatus as MyMachine["rcStatus"],
  }));
  const [earnings, calendar] = await Promise.all([
    ownerEarnings(user),
    machines[0] ? ownerCalendar(user, machines[0].id, today.slice(0, 7)) : Promise.resolve([]),
  ]);
  const requests = bookings
    .filter((b) => b.role === "owner" && b.status === "REQUESTED")
    .sort((a, b) => new Date(a.replyBy).getTime() - new Date(b.replyBy).getTime());
  return (
    <Dashboard
      name={(user.name ?? "").split(/\s+/)[0]}
      earnings={earnings}
      requests={requests}
      machines={machines}
      today={today}
      calendar={calendar}
    />
  );
}
