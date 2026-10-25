"use client";

import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChipGroup } from "@/components/ui/chip-group";
import { StickyCTA } from "@/components/ui/sticky-cta";
import type { Attachment, PriceUnit, Slot } from "@/lib/domain";
import { SLOTS } from "@/lib/domain";
import { formatRupees } from "@/lib/format";
import { dayCount, estimateQty, fmtDays, fmtShort } from "@/lib/rent";
import { useChoice } from "./booking-choice";
import type { DayState } from "./availability-grid";

export interface BookMachine {
  priceRupees: number;
  unit: PriceUnit;
  altPrice: { unit: PriceUnit; rupees: number } | null;
  operatorIncluded: boolean;
  dieselIncluded: boolean;
  attachments: string[];
}

/** Price panel, and the way into booking: a sticky bar on phones, an inline card from 1024 px. */
export function BookCard({
  m,
  days,
  acres,
  hideBar = false,
}: {
  m: BookMachine;
  days: DayState[];
  acres: number | null;
  /** The booking sheet is open on top: no second Book bar underneath. */
  hideBar?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const { range, slot, setSlot, bookHref } = useChoice();
  const state = new Map(days.map((d) => [d.date, d.state]));
  const n = dayCount(range.from, range.to);
  let taken = false;
  for (const d of days)
    if (d.date >= range.from && d.date <= range.to && state.get(d.date) !== "free") taken = true;

  const qty = estimateQty(m.unit, acres, n, slot);
  const est = formatRupees(Math.round((m.priceRupees * 100 * qty) / 100) * 100, locale);
  const what =
    m.unit === "hour"
      ? t("detail.estHours", { n: qty })
      : m.unit === "acre"
        ? t("search.acres", { n: qty })
        : t("detail.estDays", { n: qty });
  const dates = fmtShort(range.from, range.to, locale);
  const unitLabel = (u: PriceUnit) => t(`units.${u}`);

  const pickOther = () => {
    const grid = document.getElementById("availability");
    grid?.scrollIntoView({ behavior: "smooth", block: "center" });
    grid?.focus({ preventScroll: true });
  };

  return (
    <>
      <Card className="flex flex-col gap-3 lg:sticky lg:top-[88px] lg:p-6" as="section">
        <h2 className="sr-only">{t("detail.bookingCard")}</h2>
        <p className="flex flex-wrap items-baseline gap-2">
          <span className="text-price tabular-nums">{formatRupees(m.priceRupees * 100, locale)}</span>
          <span className="text-small text-text-muted">{unitLabel(m.unit)}</span>
          {m.altPrice && (
            <span className="ml-auto text-small text-text-muted">
              {t("detail.orPrice", {
                price: formatRupees(m.altPrice.rupees * 100, locale),
                unit: unitLabel(m.altPrice.unit),
              })}
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {m.operatorIncluded && <Badge variant="confirmed">{t("detail.driver")}</Badge>}
          {m.dieselIncluded && <Badge variant="confirmed">{t("detail.diesel")}</Badge>}
        </div>
        {m.attachments.length > 0 && (
          <p className="text-small">
            <span className="text-text-muted">{t("detail.comesWith")}</span>{" "}
            <strong>{m.attachments.map((a) => t(`attach.${a as Attachment}`)).join(", ")}</strong>
          </p>
        )}
        <div className="hidden flex-col gap-3 border-t border-border-subtle pt-3 lg:flex">
          <p className="text-label">{t("detail.yourDates")}</p>
          <p className="rounded-control border-2 border-action bg-selected/30 px-3 py-3 text-small">
            <strong>{fmtDays(range.from, range.to, locale)}</strong> · {t("search.days", { n })}
          </p>
          <ChipGroup
            label={t("detail.slotLabel")}
            value={slot}
            onChange={(v) => {
              setSlot(v as Slot);
            }}
            options={SLOTS.map((s) => ({ value: s, label: t(`booking.slot.${s}`) }))}
          />
          <p className="text-small text-text-muted">
            <strong className="text-[1.25rem] text-text">{est}</strong> {t("detail.est", { what })}
          </p>
          {taken ? (
            <Button onClick={pickOther}>{t("detail.pickOther")}</Button>
          ) : (
            <ButtonLink href={bookHref} prefetch={false} data-testid="book-inline">
              {t("detail.book", { dates })}
            </ButtonLink>
          )}
        </div>
      </Card>
      {!hideBar && (
        <div className="lg:hidden">
          <StickyCTA price={est} caption={t("detail.est", { what })}>
            {taken ? (
              <Button onClick={pickOther}>{t("detail.pickOther")}</Button>
            ) : (
              <ButtonLink href={bookHref} prefetch={false} data-testid="book-bar">
                {t("detail.book", { dates })}
              </ButtonLink>
            )}
          </StickyCTA>
        </div>
      )}
    </>
  );
}
