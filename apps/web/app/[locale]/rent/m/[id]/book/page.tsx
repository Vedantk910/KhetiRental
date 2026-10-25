import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookingSheet } from "@/components/rent/booking-sheet";
import { MachineDetailView } from "@/components/rent/machine-detail";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { Locale } from "@/i18n/routing";
import type { Category, PaymentMethod, PriceUnit } from "@/lib/domain";
import { PAYMENT_METHODS } from "@/lib/domain";
import { toAsciiNumber } from "@/lib/format";
import { estimateQty, filtersToQuery, parseFilters, presetRange, type Raw } from "@/lib/rent";
import { machineDays } from "@/server/machines";
import { bookingWindow, cancelDeadline, quote, todayIst } from "@/server/pricing";
import { loadMachine } from "@/server/rent-pages";

export const metadata: Metadata = { robots: { index: false } };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function BookPage({
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
  const today = todayIst();
  const f = parseFilters(sp, today);
  const m = await loadMachine(id, f);
  if (!m) {
    const t = await getTranslations({ locale: locale as Locale, namespace: "detail" });
    return (
      <div className="mx-auto max-w-app px-4 py-8 sm:px-6">
        <EmptyState
          title={t("unavailable")}
          actions={
            <ButtonLink href={`/rent/results?${filtersToQuery(f).toString()}`}>
              {t("backToResults")}
            </ButtonLink>
          }
        />
      </div>
    );
  }
  const range = f.from && f.to ? { from: f.from, to: f.to } : presetRange("tomorrow", today);
  const qs = filtersToQuery({ ...f, ...range, view: "list" }).toString();
  const detailHref = `/rent/m/${m.id}?${qs}`;
  // Your own machine can't be booked; send the owner back to its page.
  if (m.isMine) redirect(`/${locale}${detailHref}`);

  const unit = m.unit as PriceUnit;
  const w = bookingWindow(range.from, range.to, f.slot);
  const priced = {
    category: m.category as Category,
    hp: m.hp,
    priceUnit: unit,
    pricePaise: m.priceRupees * 100,
    dieselIncluded: m.dieselIncluded,
  };
  // A tampered qty falls back to the estimate instead of an error page.
  const wanted = toAsciiNumber(first(sp.qty) ?? "");
  let q;
  try {
    q = quote(priced, {
      days: w.days,
      slot: f.slot,
      qty: Number.isNaN(wanted) ? estimateQty(unit, f.acres, w.days, f.slot) : wanted,
    });
  } catch {
    q = quote(priced, { days: w.days, slot: f.slot, qty: estimateQty(unit, f.acres, w.days, f.slot) });
  }

  const rawStep = Number(first(sp.step));
  let step: 1 | 2 | 3 = rawStep === 2 || rawStep === 3 ? rawStep : 1;
  const days = step === 1 ? await machineDays(m.id, 90) : m.days14;
  // Taken in the meantime (or a hand-typed URL): back to step 1 with a notice.
  const busy = days.some((d) => d.date >= range.from && d.date <= range.to && d.state !== "free");
  const busyNotice = busy && step > 1;
  if (busyNotice) step = 1;
  const rawMethod = first(sp.method);
  const method: PaymentMethod = PAYMENT_METHODS.find((x) => x === rawMethod) ?? "upi";

  return (
    <>
      <div inert aria-hidden="true">
        <MachineDetailView m={m} filters={{ ...f, ...range }} today={today} hideBar />
      </div>
      <BookingSheet
        key={`${step}-${range.from}-${range.to}-${f.slot}-${q.qty}`}
        machineId={m.id}
        step={step}
        range={range}
        slot={f.slot}
        unit={unit}
        acres={f.acres}
        qty={q.qty}
        quote={{
          qty: q.qty,
          ratePaise: q.ratePaise,
          rentPaise: q.rentPaise,
          depositPaise: q.depositPaise,
          dieselIncluded: q.dieselIncluded,
          totalPaise: q.totalPaise,
          cancelDeadline: cancelDeadline(w.start).toISOString(),
        }}
        method={method}
        days={days}
        today={today}
        closeHref={detailHref}
        baseQs={filtersToQuery({ ...f, view: "list" }).toString()}
        busyNotice={busyNotice}
      />
    </>
  );
}
