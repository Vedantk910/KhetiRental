import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookingDetail } from "@/components/rent/booking-detail";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { Locale } from "@/i18n/routing";
import type { Raw } from "@/lib/rent";
import { getBookingByCode, myProblems } from "@/server/bookings";
import { ApiError } from "@/server/http";
import { ownerReplyMinutes } from "@/server/machines";
import { pageUser } from "@/server/page-user";

export const metadata: Metadata = { robots: { index: false } };

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; code: string }>;
  searchParams: Promise<Raw>;
}) {
  const { locale, code } = await params;
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- next/root-params needs Next 16; this is the Next 15 API
  setRequestLocale(locale as Locale);
  const user = await pageUser();
  if (!user) notFound();
  try {
    const b = await getBookingByCode(user, code);
    const [problems, minutes] = await Promise.all([myProblems(user, b.id), ownerReplyMinutes(b.machine.id)]);
    const sp = await searchParams;
    return <BookingDetail b={b} problems={problems} replyMinutes={minutes} justBooked={sp.new === "1"} />;
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 404) throw e;
    const t = await getTranslations({ locale: locale as Locale, namespace: "bookings" });
    return (
      <div className="mx-auto max-w-app px-4 py-8 sm:px-6">
        <EmptyState
          as="h1"
          title={t("notFound")}
          actions={<ButtonLink href="/bookings">{t("backToBookings")}</ButtonLink>}
        />
      </div>
    );
  }
}
