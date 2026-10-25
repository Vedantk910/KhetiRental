"use client";

import { Volume2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { PriceRow } from "@/components/ui/price-row";
import { Sheet } from "@/components/ui/sheet";
import { Stepper } from "@/components/ui/stepper";
import { Link, useRouter } from "@/i18n/navigation";
import { type PaymentMethod, type PriceUnit, SLOTS, type Slot } from "@/lib/domain";
import { formatRupees } from "@/lib/format";
import { dayCount, estimateQty, fmtDays, type Range } from "@/lib/rent";
import { cn } from "@/lib/utils";
import { SLOT_HOURS } from "@/server/pricing";
import { DateRangeSheet } from "./date-range-sheet";
import type { DayState } from "./availability-grid";

export interface QuoteView {
  qty: number;
  ratePaise: number;
  rentPaise: number;
  depositPaise: number;
  dieselIncluded: boolean;
  totalPaise: number;
  cancelDeadline: string;
}

type Props = {
  machineId: string;
  step: 1 | 2 | 3;
  range: Range;
  slot: Slot;
  unit: PriceUnit;
  acres: number | null;
  qty: number;
  quote: QuoteView;
  method: PaymentMethod;
  days: DayState[];
  today: string;
  /** The detail page, for ✕. */
  closeHref: string;
  /** The rest of the search, carried between steps. */
  baseQs: string;
  busyNotice: boolean;
};

const METHODS: { id: PaymentMethod; key: "upi" | "card" | "net" | "cash" }[] = [
  { id: "upi", key: "upi" },
  { id: "card", key: "card" },
  { id: "net", key: "net" },
  { id: "cash", key: "cash" },
];

/** One idempotency key per booking attempt, kept in sessionStorage so a retry or a refresh never books twice. */
function idempotencyKey(machineId: string, sig: string, fresh = false): string {
  const name = `kr-book-${machineId}`;
  try {
    if (!fresh) {
      const saved = JSON.parse(sessionStorage.getItem(name) ?? "null") as { sig: string; key: string } | null;
      if (saved?.sig === sig) return saved.key;
    }
    const key = crypto.randomUUID();
    sessionStorage.setItem(name, JSON.stringify({ sig, key }));
    return key;
  } catch {
    return crypto.randomUUID();
  }
}

export function BookingSheet(p: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [range, setRange] = useState(p.range);
  const [slot, setSlot] = useState(p.slot);
  const [qty, setQty] = useState(p.qty);
  const [method, setMethod] = useState(p.method);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ code: string; key: string } | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  useEffect(() => {
    setMounted(true);
    setCanSpeak("speechSynthesis" in window);
  }, []);

  const n = dayCount(range.from, range.to);
  const free = new Map(p.days.map((d) => [d.date, d.state === "free"]));
  const unavailable = (d: string) => free.get(d) === false;
  const maxQty =
    p.unit === "hour" ? n * (SLOT_HOURS[slot].to - SLOT_HOURS[slot].from) : p.unit === "acre" ? 500 : 0;
  const money = (paise: number) => formatRupees(paise, locale);
  const qtyText = (v: number) =>
    p.unit === "hour"
      ? t("booking.qtyHours", { n: v })
      : p.unit === "acre"
        ? t("search.acres", { n: v })
        : t("booking.qtyDays", { n: v });

  const query = (over: Record<string, string>) => {
    const q = new URLSearchParams(p.baseQs);
    q.set("from", range.from);
    q.set("to", range.to);
    q.set("slot", slot);
    if (p.unit !== "day") q.set("qty", String(qty));
    q.set("method", method);
    for (const [k, v] of Object.entries(over)) q.set(k, v);
    return q.toString();
  };
  const go = (step: number, replace = false) => {
    const href = `/rent/m/${p.machineId}/book?${query({ step: String(step) })}`;
    if (replace) router.replace(href);
    else router.push(href);
  };

  const title = [t("booking.s1.title"), t("booking.s2.title"), t("booking.s3.title")][p.step - 1];
  const time = new Intl.DateTimeFormat(`${locale}-IN`, {
    hour: "numeric",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(new Date(`2026-01-01T${String(SLOT_HOURS[p.slot].from).padStart(2, "0")}:00:00+05:30`));
  const deadline = new Intl.DateTimeFormat(`${locale}-IN`, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(new Date(p.quote.cancelDeadline));

  // Kept in the URL so a refresh shows the same choice.
  const chooseMethod = (m: PaymentMethod) => {
    setMethod(m);
    const u = new URL(window.location.href);
    u.searchParams.set("method", m);
    window.history.replaceState(window.history.state, "", u);
  };

  const next = () => {
    if (unavailable(range.from) || [...free].some(([d, ok]) => !ok && d >= range.from && d <= range.to)) {
      setError({ code: "machine_unavailable", key: "booking.dateBusy" });
      return;
    }
    go(p.step + 1);
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const sig = [p.range.from, p.range.to, p.slot, p.quote.qty].join("|");
    try {
      const create = async (key: string) =>
        fetch("/api/bookings", {
          method: "POST",
          headers: { "content-type": "application/json", "idempotency-key": key },
          body: JSON.stringify({
            machineId: p.machineId,
            startDate: p.range.from,
            endDate: p.range.to,
            slot: p.slot,
            ...(p.unit === "day" ? {} : { qty: p.quote.qty }),
          }),
        });
      let res = await create(idempotencyKey(p.machineId, sig));
      let booking = (await res.json()) as {
        id: string;
        code: string;
        status: string;
        payment: unknown;
        code_?: string;
      };
      // The same key finding a closed booking means this is "book again": start a fresh attempt.
      if (res.ok && !["REQUESTED", "CONFIRMED"].includes(booking.status)) {
        res = await create(idempotencyKey(p.machineId, sig, true));
        booking = (await res.json()) as typeof booking;
      }
      if (!res.ok) {
        const code = (booking as unknown as { code: string }).code;
        setError({
          code,
          key: code === "machine_unavailable" ? "booking.taken" : `errors.api.${code}`,
        });
        setBusy(false);
        return;
      }
      if (method === "cash") {
        if (!booking.payment) {
          const pay = await fetch(`/api/bookings/${booking.id}/pay`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ method: "cash", amountPaise: p.quote.totalPaise }),
          });
          if (!pay.ok && pay.status !== 409) throw new Error("pay");
        }
        router.replace(`/bookings/${booking.code}?new=1`);
      } else if (booking.payment) {
        router.replace(`/bookings/${booking.code}?new=1`);
      } else {
        router.push(`/rent/m/${p.machineId}/book/pay?b=${booking.id}&method=${method}`);
      }
    } catch {
      setError({ code: "network", key: "errors.offlineSubmit" });
      setBusy(false);
    }
  };

  const spoken = () =>
    t("booking.spoken", {
      rent: money(p.quote.rentPaise),
      diesel: p.quote.dieselIncluded ? t("booking.included") : t("booking.dieselSeparate"),
      deposit: money(p.quote.depositPaise),
      total: money(p.quote.totalPaise),
    });
  const speak = () => {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(spoken());
    u.lang = `${locale}-IN`;
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(locale));
    if (voice) u.voice = voice;
    u.onend = () => {
      setSpeaking(false);
    };
    setSpeaking(true);
    synth.speak(u);
  };
  useEffect(
    () => () => {
      window.speechSynthesis.cancel();
    },
    [],
  );

  return (
    <>
      <Sheet
        open={mounted}
        busy={busy}
        onClose={() => {
          router.push(p.closeHref);
        }}
        title={
          <>
            <span className="block text-caption font-bold text-text-subtle">
              {t("booking.step", { n: p.step })}
            </span>
            {title}
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div aria-hidden className="flex gap-[6px]">
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                className={cn("h-[6px] flex-1 rounded-[3px]", i <= p.step ? "bg-action" : "bg-border-subtle")}
              />
            ))}
          </div>

          {p.step === 1 && (
            <>
              {p.busyNotice && (
                <p role="alert" className="rounded-control bg-danger-bg p-3 text-small text-danger">
                  {t("booking.dateBusy")}
                </p>
              )}
              <button
                type="button"
                aria-label={t("booking.changeDates")}
                onClick={() => {
                  setPicking(true);
                }}
                className="rounded-control border-2 border-action bg-selected/30 p-[14px] text-left text-body"
              >
                <strong>{fmtDays(range.from, range.to, locale)}</strong> · {t("search.days", { n })}
              </button>
              <ChipGroup
                label={t("booking.slotLabel")}
                value={slot}
                onChange={(v) => {
                  const s = v as Slot;
                  setSlot(s);
                  setQty((q) => Math.min(q, maxFor(p.unit, n, s)));
                }}
                options={SLOTS.map((s) => ({ value: s, label: t(`booking.slot.${s}`) }))}
              />
              {p.unit !== "day" && (
                <div className="flex flex-col gap-2">
                  <p className="text-label">
                    {p.unit === "hour" ? t("booking.hoursLabel") : t("booking.acresLabel")}
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <Stepper
                      label={p.unit === "hour" ? t("booking.hoursLabel") : t("booking.acresLabel")}
                      value={qty}
                      onChange={setQty}
                      min={0.5}
                      max={maxQty}
                      step={0.5}
                      decLabel={t("search.fewerAcres")}
                      incLabel={t("search.moreAcres")}
                    />
                    <span className="text-small text-text-muted">{qtyText(qty)}</span>
                  </div>
                  {p.unit === "hour" && (
                    <p className="text-small text-text-muted">{t("booking.hoursHint")}</p>
                  )}
                </div>
              )}
              <p className="text-small text-text-muted">{t("booking.s1.info", { time })}</p>
            </>
          )}

          {p.step === 2 && (
            <>
              <div className="flex flex-col gap-[10px] rounded-card bg-surface-muted p-4">
                <PriceRow
                  label={t("booking.rent", { qty: qtyText(p.quote.qty), rate: money(p.quote.ratePaise) })}
                  value={money(p.quote.rentPaise)}
                />
                <PriceRow
                  label={t("booking.diesel")}
                  value={
                    p.quote.dieselIncluded ? (
                      <strong className="text-success">{t("booking.included")}</strong>
                    ) : (
                      t("booking.dieselSeparate")
                    )
                  }
                />
                <PriceRow
                  label={
                    <>
                      {t("booking.deposit")}{" "}
                      <em className="text-small not-italic text-text-muted">{t("booking.depositNote")}</em>
                    </>
                  }
                  value={money(p.quote.depositPaise)}
                />
                <PriceRow
                  total
                  label={method === "cash" ? t("booking.payAfter") : t("booking.youPay")}
                  value={money(p.quote.totalPaise)}
                />
              </div>
              {canSpeak && (
                <Button variant="secondary" size="md" onClick={speak}>
                  <Volume2 aria-hidden className="h-5 w-5" />
                  {speaking ? t("booking.stop") : t("booking.readAloud")}
                </Button>
              )}
            </>
          )}

          {p.step === 3 && (
            <>
              <div role="radiogroup" aria-label={t("booking.payWith")} className="flex flex-col gap-2">
                {METHODS.map((m) => {
                  const on = method === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => {
                        chooseMethod(m.id);
                      }}
                      onKeyDown={(e) => {
                        const i = METHODS.findIndex((x) => x.id === method);
                        const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
                        if (d === undefined) return;
                        e.preventDefault();
                        chooseMethod(METHODS[(i + d + METHODS.length) % METHODS.length].id);
                      }}
                      tabIndex={on ? 0 : -1}
                      className={cn(
                        "flex min-h-[60px] items-center gap-3 rounded-control border-2 px-[14px] py-2 text-left",
                        on ? "border-action bg-selected/30" : "border-chip bg-surface",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "h-[22px] w-[22px] shrink-0 rounded-pill border-2 border-action",
                          on && "bg-action",
                        )}
                      />
                      <span className="flex flex-col">
                        <span className="text-[1.0625rem] font-bold">{t(`pay.${m.key}`)}</span>
                        <span className="text-caption text-text-muted">{t(`pay.${m.key}Hint`)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="rounded-control bg-info-bg p-3 text-small text-info">
                {t("pay.demoBanner", { deadline })}
              </p>
              {error && (
                <div
                  role="alert"
                  className="flex flex-col items-start gap-2 rounded-control bg-danger-bg p-3 text-small text-danger"
                >
                  <p>{t(error.key as "booking.taken")}</p>
                  {error.code === "machine_unavailable" && (
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => {
                        go(1);
                      }}
                    >
                      {t("booking.pickOther")}
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
          {p.step < 3 && error && (
            <p role="alert" className="rounded-control bg-danger-bg p-3 text-small text-danger">
              {t(error.key as "booking.dateBusy")}
            </p>
          )}

          {p.step < 3 ? (
            <Button onClick={next}>{t("common.next")}</Button>
          ) : (
            <Button loading={busy} onClick={() => void submit()}>
              {method === "cash"
                ? t("pay.ctaCash")
                : t("pay.ctaOnline", { amount: money(p.quote.totalPaise) })}
            </Button>
          )}
          {p.step > 1 && (
            <Link
              href={`/rent/m/${p.machineId}/book?${query({ step: String(p.step - 1) })}`}
              replace
              className="flex min-h-tap items-center justify-center text-label text-link underline underline-offset-4"
            >
              {t("common.back")}
            </Link>
          )}
        </div>
      </Sheet>
      {picking && (
        <DateRangeSheet
          open
          value={range}
          minDay={p.today}
          unavailable={unavailable}
          onClose={() => {
            setPicking(false);
          }}
          onApply={(r) => {
            setRange(r);
            setQty(
              (q) =>
                Math.min(q, maxFor(p.unit, dayCount(r.from, r.to), slot)) ||
                estimateQty(p.unit, p.acres, dayCount(r.from, r.to), slot),
            );
            setPicking(false);
          }}
        />
      )}
    </>
  );
}

const maxFor = (unit: PriceUnit, days: number, slot: Slot) =>
  unit === "hour" ? days * (SLOT_HOURS[slot].to - SLOT_HOURS[slot].from) : unit === "acre" ? 500 : 0;
