import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MockPay } from "@/components/rent/mock-pay";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { Locale } from "@/i18n/routing";
import { type Raw } from "@/lib/rent";
import { getBooking } from "@/server/bookings";
import { ApiError, uuidParam } from "@/server/http";
import { pageUser } from "@/server/page-user";

export const metadata: Metadata = { robots: { index: false } };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<Raw>;
}) {
  const { locale, id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- next/root-params needs Next 16; this is the Next 15 API
  setRequestLocale(locale as Locale);
  const sp = await searchParams;
  const user = await pageUser();
  const method = (["upi", "card", "net"] as const).find((x) => x === first(sp.method));
  let booking;
  try {
    if (user) booking = await getBooking(user, uuidParam(first(sp.b) ?? ""));
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
  }
  // Somebody else's booking, a made-up id, a closed booking or a paid one: no payment screen.
  if (booking?.payment?.status === "paid_demo" || booking?.payment?.status === "pay_later")
    redirect(`/${locale}/bookings/${booking.code}?new=1`);
  if (
    !booking ||
    booking.role !== "renter" ||
    booking.machine.id !== id ||
    !method ||
    !["REQUESTED", "CONFIRMED"].includes(booking.status)
  ) {
    const t = await getTranslations({ locale: locale as Locale, namespace: "pay" });
    return (
      <div className="mx-auto max-w-app px-4 py-8 sm:px-6">
        <EmptyState
          as="h1"
          title={t("missing")}
          actions={<ButtonLink href="/bookings">{t("openBooking")}</ButtonLink>}
        />
      </div>
    );
  }
  const back = new URLSearchParams({
    from: booking.startDate,
    to: booking.endDate,
    slot: booking.slot,
    qty: String(booking.qty),
    method,
    step: "3",
  });
  return (
    <MockPay
      bookingId={booking.id}
      code={booking.code}
      totalPaise={booking.totalPaise}
      method={method}
      backHref={`/rent/m/${id}/book?${back.toString()}`}
    />
  );
}
