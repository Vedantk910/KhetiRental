"use client";

import { CircleCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChipGroup } from "@/components/ui/chip-group";
import { EmptyState } from "@/components/ui/empty-state";
import { Link } from "@/i18n/navigation";
import { fmtDays, whatsappLink } from "@/lib/rent";
import { cn } from "@/lib/utils";
import type { BookingView } from "./booking-detail";
import { CancelButton } from "./cancel-sheet";
import { StatusBadge } from "./status-badge";

const ACTIVE = ["REQUESTED", "CONFIRMED", "IN_PROGRESS"];
const cell = "inline-flex min-h-tap items-center justify-center rounded-control border-2 px-2 text-label";
const on = "border-border-control bg-surface text-text hover:bg-surface-muted";
const off = "!border-transparent bg-surface-muted text-text-subtle cursor-not-allowed";

function Item({ b }: { b: BookingView }) {
  const t = useTranslations("bookings");
  const locale = useLocale();
  const ownerFirst = (b.owner.name ?? "").split(/\s+/)[0];
  const dates = fmtDays(b.startDate, b.endDate, locale);
  const phone = b.owner.phone;
  const live = ACTIVE.includes(b.status);
  return (
    <Card as="li" variant="booking" className="relative flex flex-col gap-[6px] p-[14px]">
      <div className="flex items-center justify-between gap-2">
        <StatusBadge status={b.status} />
        <span className="text-small text-text-muted">{t("code", { code: b.code })}</span>
      </div>
      <h2 className="text-body font-bold">
        <Link
          href={`/bookings/${b.code}`}
          prefetch={false}
          className="after:absolute after:inset-0 after:content-['']"
        >
          {dates}
        </Link>
      </h2>
      <p className="text-small text-text-muted">
        {b.machine.name} · {ownerFirst}
      </p>
      {live && (
        <>
          <div className="relative z-10 mt-2 grid grid-cols-3 gap-2">
            {phone ? (
              <a href={`tel:${phone}`} className={cn(cell, on)}>
                {t("call")}
              </a>
            ) : (
              <span aria-disabled="true" role="link" className={cn(cell, off)}>
                {t("call")}
              </span>
            )}
            {phone ? (
              <a
                href={whatsappLink(phone, t("whatsappText", { owner: ownerFirst, code: b.code, dates }))}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(cell, on)}
              >
                {t("whatsapp")}
              </a>
            ) : (
              <span aria-disabled="true" role="link" className={cn(cell, off)}>
                {t("whatsapp")}
              </span>
            )}
            {["REQUESTED", "CONFIRMED"].includes(b.status) ? (
              <CancelButton bookingId={b.id} cancelDeadline={String(b.cancelDeadline)} size="md" />
            ) : (
              <span />
            )}
          </div>
          {!phone && <p className="text-caption text-text-subtle">{t("numberLater")}</p>}
          <Link
            href={`/bookings/${b.code}/problem`}
            className="relative z-10 inline-flex min-h-tap items-center text-small text-link underline underline-offset-4"
          >
            {t("report")}
          </Link>
        </>
      )}
    </Card>
  );
}

/** My bookings: Upcoming / Past tabs, a card each (UI-SPEC §4.9). */
export function BookingsList({
  items,
  initialTab,
  newOwner,
}: {
  items: BookingView[];
  initialTab: "upcoming" | "past";
  newOwner: string | null;
}) {
  const t = useTranslations("bookings");
  const [tab, setTab] = useState(initialTab);
  const upcoming = items
    .filter((b) => ACTIVE.includes(b.status))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const past = items.filter((b) => !ACTIVE.includes(b.status));
  const shown = tab === "upcoming" ? upcoming : past;
  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-4 px-4 py-4 pb-8 sm:px-6">
      <h1 className="text-h2">{t("title")}</h1>
      {newOwner && (
        <div role="status" className="flex items-start gap-3 rounded-card bg-success-bg p-4 text-success">
          <CircleCheck aria-hidden className="mt-1 h-[28px] w-[28px] shrink-0" />
          <p className="text-h3">{t("sent", { owner: newOwner })}</p>
        </div>
      )}
      <ChipGroup
        label={t("tabsLabel")}
        value={tab}
        onChange={(v) => {
          setTab(v as "upcoming" | "past");
          const u = new URL(window.location.href);
          u.searchParams.set("tab", v);
          window.history.replaceState(window.history.state, "", u);
        }}
        options={[
          { value: "upcoming", label: t("upcoming", { n: upcoming.length }) },
          { value: "past", label: t("past") },
        ]}
      />
      {shown.length === 0 ? (
        <EmptyState
          title={tab === "upcoming" ? t("empty") : t("emptyPast")}
          actions={tab === "upcoming" ? <ButtonLink href="/rent">{t("findOne")}</ButtonLink> : undefined}
        />
      ) : (
        <ul aria-label={t("listLabel")} className="flex flex-col gap-3">
          {shown.map((b) => (
            <Item key={b.id} b={b} />
          ))}
        </ul>
      )}
    </div>
  );
}
