"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { BookingView } from "@/components/rent/booking-detail";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { PriceUnit } from "@/lib/domain";
import { formatRupees } from "@/lib/format";
import { fmtDays } from "@/lib/rent";
import { ReplyButtons, ReplyTimer } from "./reply";

/** "2.5 acres", "4 h", "2 days" for the quantity the renter asked for. */
export function useQtyText() {
  const tr = useTranslations();
  return (unit: PriceUnit, qty: number) =>
    unit === "hour"
      ? tr("booking.qtyHours", { n: qty })
      : unit === "acre"
        ? tr("search.acres", { n: qty })
        : tr("booking.qtyDays", { n: qty });
}

/** A new request: who, what, when, how much, the reply timer and Accept / Decline (UI-SPEC §4.12). */
export function RequestCard({ b }: { b: BookingView }) {
  const t = useTranslations("owner");
  const locale = useLocale();
  const qtyText = useQtyText();
  const [gone, setGone] = useState(false);
  if (gone) return null;
  const name = b.renter.name ?? "";
  return (
    <Card as="li" variant="request" className="relative flex flex-col gap-1">
      <div className="flex flex-wrap items-start justify-between gap-x-2">
        <h3 className="text-body font-bold">
          <Link
            href={`/owner/requests/${b.code}`}
            prefetch={false}
            className="after:absolute after:inset-0 after:content-['']"
          >
            {t("reqLine", { name, qty: qtyText(b.unit as PriceUnit, b.qty) })}
          </Link>
        </h3>
        <ReplyTimer replyBy={String(b.replyBy)} />
      </div>
      <p className="text-small text-text-muted">
        {fmtDays(b.startDate, b.endDate, locale)} · {b.machine.name}
      </p>
      <p className="text-h2">{formatRupees(b.totalPaise, locale)}</p>
      <ReplyButtons
        bookingId={b.id}
        renterFirst={name.split(/\s+/)[0]}
        className="relative z-10 mt-1"
        onDone={() => {
          setGone(true);
        }}
      />
    </Card>
  );
}
