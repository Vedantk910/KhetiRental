import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProblemForm } from "@/components/rent/problem-form";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { Locale } from "@/i18n/routing";
import { getBookingByCode } from "@/server/bookings";
import { ApiError } from "@/server/http";
import { pageUser } from "@/server/page-user";

export const metadata: Metadata = { robots: { index: false } };

export default async function ProblemPage({ params }: { params: Promise<{ locale: string; code: string }> }) {
  const { locale, code } = await params;
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- next/root-params needs Next 16; this is the Next 15 API
  setRequestLocale(locale as Locale);
  const user = await pageUser();
  if (!user) notFound();
  try {
    const b = await getBookingByCode(user, code);
    return <ProblemForm bookingId={b.id} code={b.code} role={b.role} />;
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 404) throw e;
    const t = await getTranslations({ locale: locale as Locale, namespace: "bookings" });
    return (
      <div className="mx-auto max-w-app px-4 py-8 sm:px-6">
        <EmptyState
          title={t("notFound")}
          actions={<ButtonLink href="/bookings">{t("backToBookings")}</ButtonLink>}
        />
      </div>
    );
  }
}
