import { CalendarPlus, CircleCheck, MapPin, MessageCircle, Phone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PriceRow } from "@/components/ui/price-row";
import { Link } from "@/i18n/navigation";
import type { Attachment, PriceUnit } from "@/lib/domain";
import { formatRupees } from "@/lib/format";
import { fmtDays, whatsappLink } from "@/lib/rent";
import { SLOT_HOURS } from "@/server/pricing";
import type { getBookingByCode } from "@/server/bookings";
import { CancelButton } from "./cancel-sheet";
import { CopyCode } from "./copy-code";
import { MachinePicture } from "./machine-card";
import { StatusBadge } from "./status-badge";

export type BookingView = Awaited<ReturnType<typeof getBookingByCode>>;

const btn =
  "inline-flex min-h-tap items-center justify-center gap-2 rounded-control border-2 border-border-control bg-surface px-4 text-label text-text hover:bg-surface-muted";

type Event = {
  at: Date;
  key: "requested" | "accepted" | "declined" | "cancelled" | "expired" | "completed" | "problem";
};

/** The booking page (UI-SPEC §4.8). `justBooked` shows the confirmation banner on top. */
export function BookingDetail({
  b,
  problems,
  replyMinutes,
  justBooked,
}: {
  b: BookingView;
  problems: { type: string; createdAt: Date }[];
  replyMinutes: number | null;
  justBooked: boolean;
}) {
  const t = useTranslations("bookings");
  const ta = useTranslations("attach");
  const tr = useTranslations();
  const locale = useLocale();
  const status = b.status;
  const renter = b.role === "renter";
  const money = (p: number) => formatRupees(p, locale);
  const fromTime = new Intl.DateTimeFormat(`${locale}-IN`, {
    hour: "numeric",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(new Date(`2026-01-01T${String(SLOT_HOURS[b.slot].from).padStart(2, "0")}:00:00+05:30`));
  const dates = fmtDays(b.startDate, b.endDate, locale);
  const unit = b.unit as PriceUnit;
  const qtyText =
    unit === "hour"
      ? tr("booking.qtyHours", { n: b.qty })
      : unit === "acre"
        ? tr("search.acres", { n: b.qty })
        : tr("booking.qtyDays", { n: b.qty });
  const phone = renter ? b.owner.phone : b.renter.phone;
  const other = renter ? b.owner.name : b.renter.name;
  const ownerFirst = (b.owner.name ?? "").split(/\s+/)[0];
  const active = ["REQUESTED", "CONFIRMED", "IN_PROGRESS"].includes(status);
  const pay = b.payment;
  const stamp = new Intl.DateTimeFormat(`${locale}-IN`, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
  const events: Event[] = [{ at: new Date(b.createdAt), key: "requested" }];
  if (b.confirmedAt) events.push({ at: new Date(b.confirmedAt), key: "accepted" });
  if (b.closedAt && ["DECLINED", "CANCELLED", "EXPIRED", "COMPLETED"].includes(status))
    events.push({ at: new Date(b.closedAt), key: status.toLowerCase() as Event["key"] });
  for (const p of problems) events.push({ at: new Date(p.createdAt), key: "problem" });
  events.sort((x, y) => x.at.getTime() - y.at.getTime());

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-4 px-4 py-4 pb-8 sm:px-6">
      {justBooked && active && (
        <div role="status" className="flex items-start gap-3 rounded-card bg-success-bg p-4 text-success">
          <CircleCheck aria-hidden className="mt-1 h-7 w-7 shrink-0" />
          <div>
            <p className="text-h3">{t("sent", { owner: ownerFirst })}</p>
            <p className="text-small text-text">
              {replyMinutes !== null
                ? t("sentBody", { owner: ownerFirst, min: replyMinutes })
                : t("sentBodyNoMin", { owner: ownerFirst })}
            </p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="sr-only">{t("detailTitle", { code: b.code })}</h1>
        <StatusBadge status={status} />
        <CopyCode code={b.code} />
      </div>
      <Card className="flex flex-col gap-1">
        <p className="text-body font-bold">
          {dates} · {t("from", { time: fromTime })}
        </p>
      </Card>
      <Card className="flex items-center gap-4">
        <MachinePicture
          m={{ photoUrl: b.machine.photoUrl, category: "tractor", name: b.machine.name }}
          className="h-[64px] w-[64px] shrink-0 overflow-hidden rounded-control"
        />
        <div className="min-w-0">
          <p className="text-body font-bold">{b.machine.name}</p>
          {b.machine.attachments.length > 0 && (
            <p className="text-small text-text-muted">
              {b.machine.attachments.map((a) => ta(a as Attachment)).join(" + ")}
            </p>
          )}
        </div>
      </Card>
      <Card className="flex flex-col gap-2">
        <p className="text-small text-text-muted">{renter ? t("owner") : t("renter")}</p>
        <p className="text-body font-bold">
          {other} · {b.machine.village}
        </p>
        {phone ? (
          <p className="text-body">{phone}</p>
        ) : (
          <p className="text-small text-text-muted">{t("noContact")}</p>
        )}
        {b.location && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${b.location.lat},${b.location.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-tap items-center gap-2 text-link underline underline-offset-4"
          >
            <MapPin aria-hidden className="h-5 w-5" />
            {t("directions")}
          </a>
        )}
      </Card>
      <Card className="flex flex-col gap-2">
        <PriceRow label={`${t("price")}: ${qtyText} × ${money(b.ratePaise)}`} value={money(b.rentPaise)} />
        <PriceRow label={t("dieselIncluded")} value={b.dieselIncluded ? "✓" : "–"} />
        <PriceRow label={tr("booking.deposit")} value={money(b.depositPaise)} />
        <PriceRow
          total
          label={pay?.status === "pay_later" ? t("payLater") : t("total")}
          value={money(b.totalPaise)}
        />
        <p className="text-small text-text-muted">
          {pay?.status === "paid_demo"
            ? t("paid", { method: t(`methods.${pay.method as "upi"}`) })
            : pay?.status === "pay_later"
              ? t("payLater")
              : t("payUnpaid")}
        </p>
      </Card>

      {renter && active && (
        <div className="grid gap-2 sm:grid-cols-2">
          {phone && (
            <>
              <a href={`tel:${phone}`} className={btn}>
                <Phone aria-hidden className="h-5 w-5" />
                {t("call")}
              </a>
              <a
                href={whatsappLink(phone, t("whatsappText", { owner: ownerFirst, code: b.code, dates }))}
                target="_blank"
                rel="noopener noreferrer"
                className={btn}
              >
                <MessageCircle aria-hidden className="h-5 w-5" />
                {t("whatsapp")}
              </a>
            </>
          )}
          {status === "CONFIRMED" && (
            <a href={`/api/bookings/${b.id}/ics`} className={btn}>
              <CalendarPlus aria-hidden className="h-5 w-5" />
              {t("calendar")}
            </a>
          )}
          {["REQUESTED", "CONFIRMED"].includes(status) && (
            <CancelButton bookingId={b.id} cancelDeadline={String(b.cancelDeadline)} />
          )}
        </div>
      )}
      {active && (
        <Link
          href={`/bookings/${b.code}/problem`}
          className="inline-flex min-h-tap items-center text-link underline underline-offset-4"
        >
          {t("report")}
        </Link>
      )}
      {renter && status === "COMPLETED" && (
        <ButtonLink href={`/rent/m/${b.machine.id}`}>{t("bookAgain")}</ButtonLink>
      )}
      {renter && ["CANCELLED", "DECLINED", "EXPIRED"].includes(status) && (
        <ButtonLink href="/rent">{t("findAnother")}</ButtonLink>
      )}

      <section aria-labelledby="tl" className="flex flex-col gap-2">
        <h2 id="tl" className="text-h3">
          {t("timeline")}
        </h2>
        <ol className="flex flex-col gap-2 border-l-2 border-chip pl-4">
          {events.map((e, i) => (
            <li key={i} className="text-small">
              <span className="font-bold">{t(`tl.${e.key}`)}</span>{" "}
              <span className="text-text-muted">{stamp.format(e.at)}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
