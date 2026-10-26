import { MessageCircle, Phone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { BookingView } from "@/components/rent/booking-detail";
import { StatusBadge } from "@/components/rent/status-badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PriceRow } from "@/components/ui/price-row";
import { StickyCTA } from "@/components/ui/sticky-cta";
import { Link } from "@/i18n/navigation";
import { keepPaise, type PriceUnit } from "@/lib/domain";
import { formatRupees } from "@/lib/format";
import { fmtDays, whatsappLink } from "@/lib/rent";
import { SLOT_HOURS } from "@/server/pricing";
import { useKmText } from "./km-text";
import { ReplyButtons, ReplyTimer } from "./reply";

const btn =
  "inline-flex min-h-tap items-center justify-center gap-2 rounded-control border-2 border-border-control bg-surface px-4 text-label text-text hover:bg-surface-muted";

/** The booking from the owner's side (UI-SPEC §4.13). The number appears only once the booking is confirmed. */
export function RequestDetail({ b }: { b: BookingView }) {
  const t = useTranslations("owner");
  const tb = useTranslations("bookings");
  const tr = useTranslations();
  const tj = useTranslations("jobs");
  const kmText = useKmText();
  const locale = useLocale();
  const money = (p: number) => formatRupees(p, locale);
  const unit = b.unit as PriceUnit;
  const qty =
    unit === "hour"
      ? tr("booking.qtyHours", { n: b.qty })
      : unit === "acre"
        ? tr("search.acres", { n: b.qty })
        : tr("booking.qtyDays", { n: b.qty });
  const name = b.renter.name ?? "";
  const phone = b.renter.phone;
  const open = b.status === "REQUESTED";
  const live = ["CONFIRMED", "IN_PROGRESS"].includes(b.status);
  const dates = fmtDays(b.startDate, b.endDate, locale);
  const from = new Intl.DateTimeFormat(`${locale}-IN`, {
    hour: "numeric",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(new Date(`2026-01-01T${String(SLOT_HOURS[b.slot].from).padStart(2, "0")}:00:00+05:30`));
  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-4 px-4 py-4 pb-8 sm:px-6">
      <h1 className="text-h2">{t("reqTitle", { code: b.code })}</h1>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusBadge status={b.status} />
        {open && <ReplyTimer replyBy={String(b.replyBy)} />}
      </div>
      <Card className="flex flex-col gap-1">
        <p className="text-small text-text-muted">{t("farmer")}</p>
        <p className="text-body font-bold">{name}</p>
        {phone ? (
          <p className="text-body">{phone}</p>
        ) : (
          <p className="text-small text-text-muted">{t("numberAfter")}</p>
        )}
      </Card>
      <Card className="flex flex-col gap-1">
        <p className="text-small text-text-muted">{t("when")}</p>
        <p className="text-body font-bold">
          {dates} · {tb("from", { time: from })}
        </p>
        <p className="text-small text-text-muted">
          {b.machine.name} · {b.machine.village}
        </p>
        <p className="text-small text-text-muted">
          {t("field")}: {qty}
        </p>
        {b.job && (
          <p className="text-small text-text-muted">
            {t("work")}: {tj(b.job)}
          </p>
        )}
        {b.distanceKm !== null && (
          <p className="text-small text-text-muted">
            {t("distance")}: {kmText(b.distanceKm)}
          </p>
        )}
      </Card>
      <Card className="flex flex-col gap-2">
        <PriceRow label={tb("price")} value={money(b.totalPaise)} />
        <PriceRow
          label={tr("list.fee", { pct: tr("list.feeValue") })}
          value={`− ${money(b.totalPaise - keepPaise(b.rentPaise))}`}
        />
        <PriceRow total label={t("youKeep")} value={money(keepPaise(b.rentPaise))} />
      </Card>
      {live && phone && (
        <div className="grid gap-2 sm:grid-cols-2">
          <a href={`tel:${phone}`} className={btn}>
            <Phone aria-hidden className="h-[20px] w-[20px]" />
            {t("call", { name: name.split(/\s+/)[0] })}
          </a>
          <a
            href={whatsappLink(
              phone,
              tb("whatsappText", { owner: name.split(/\s+/)[0], code: b.code, dates }),
            )}
            target="_blank"
            rel="noopener noreferrer"
            className={btn}
          >
            <MessageCircle aria-hidden className="h-[20px] w-[20px]" />
            {tb("whatsapp")}
          </a>
        </div>
      )}
      {(open || live) && (
        <Link
          href={`/bookings/${b.code}/problem`}
          className="inline-flex min-h-tap items-center text-link underline underline-offset-4"
        >
          {tb("report")}
        </Link>
      )}
      {!open && (
        <ButtonLink variant="secondary" href="/owner">
          {t("backToDashboard")}
        </ButtonLink>
      )}
      {open && (
        <StickyCTA>
          <ReplyButtons bookingId={b.id} renterFirst={name.split(/\s+/)[0]} />
        </StickyCTA>
      )}
    </div>
  );
}
