"use client";

import { CircleCheck, Loader2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { useRouter } from "@/i18n/navigation";
import { formatRupees } from "@/lib/format";

type Props = {
  bookingId: string;
  code: string;
  totalPaise: number;
  method: "upi" | "card" | "net";
  /** Step 3 of the booking, for ✕ and "Cancel payment". */
  backHref: string;
};

const UPI = /^[\w.-]{2,}@[A-Za-z][\w.-]{1,}$/;
const digits = (s: string) => s.replace(/\D/g, "");

/** The demo payment screen (UI-SPEC §4.7.4). Nothing typed here is sent: only {method, amountPaise} is posted. */
export function MockPay({ bookingId, code, totalPaise, method, backHref }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [phase, setPhase] = useState<"form" | "processing" | "done" | "failed">("form");
  const [touched, setTouched] = useState(false);
  const [upi, setUpi] = useState("");
  const [card, setCard] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [bank, setBank] = useState("");
  const amount = formatRupees(totalPaise, locale);

  const valid =
    method === "upi"
      ? UPI.test(upi.trim())
      : method === "card"
        ? digits(card).length >= 13 &&
          /^(0[1-9]|1[0-2])\/?\d{2}$/.test(expiry.trim()) &&
          /^\d{3,4}$/.test(cvv)
        : bank !== "";

  const pay = async (as: "upi" | "card" | "net" | "cash") => {
    setPhase("processing");
    try {
      const r = await fetch(`/api/bookings/${bookingId}/pay`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method: as, amountPaise: totalPaise }),
      });
      if (r.status === 409) {
        // Already paid (a refresh after success): nothing more to do here.
        router.replace(`/bookings/${code}?new=1`);
        return;
      }
      if (!r.ok) {
        setPhase("failed");
        return;
      }
      setPhase("done");
      setTimeout(() => {
        router.replace(`/bookings/${code}?new=1`);
      }, 1000);
    } catch {
      setPhase("failed");
    }
  };

  const submit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setTouched(true);
    if (valid) void pay(method);
  };

  return (
    <div className="mx-auto flex min-h-[calc(100svh-56px)] max-w-[480px] flex-col gap-4 px-4 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-h2">{t("pay.title")}</h1>
        <button
          type="button"
          aria-label={t("pay.cancel")}
          aria-disabled={phase === "processing" || undefined}
          onClick={() => {
            if (phase !== "processing") router.push(backHref);
          }}
          className="flex h-tap w-tap items-center justify-center rounded-pill border-2 border-chip hover:bg-surface-muted"
        >
          <X aria-hidden className="h-6 w-6" />
        </button>
      </div>
      <Badge variant="sample" className="self-start text-small">
        {t("pay.demoLabel")}
      </Badge>
      <div className="rounded-card border border-border-subtle bg-surface p-4">
        <p className="text-price tabular-nums">{amount}</p>
        <p className="text-small text-text-muted">{t("pay.amountCard", { amount })}</p>
      </div>

      {phase === "done" && (
        <div
          role="status"
          className="flex flex-col items-center gap-2 rounded-card bg-success-bg p-6 text-success"
        >
          <CircleCheck aria-hidden className="h-12 w-12" />
          <p className="text-h3">{t("pay.done")}</p>
        </div>
      )}
      {phase === "processing" && (
        <div role="status" className="flex flex-col items-center gap-2 p-6">
          <Loader2 aria-hidden className="h-10 w-10 animate-spin text-action" />
          <p className="text-h4">{t("pay.processing")}</p>
        </div>
      )}
      {phase === "failed" && (
        <div role="alert" className="flex flex-col gap-3 rounded-card bg-danger-bg p-4 text-danger">
          <p className="text-h4">{t("pay.failed")}</p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setPhase("form");
              }}
            >
              {t("pay.tryAgain")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                void pay("cash");
              }}
            >
              {t("pay.payLater")}
            </Button>
          </div>
        </div>
      )}

      {phase === "form" && (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4" autoComplete="off">
          {method === "upi" && (
            <Input
              label={t("pay.upiId")}
              placeholder={t("pay.upiIdPh")}
              value={upi}
              onChange={(e) => {
                setUpi(e.target.value);
              }}
              autoComplete="off"
              inputMode="email"
              maxLength={60}
              error={touched && !valid ? t("errors.api.invalid_request") : undefined}
            />
          )}
          {method === "card" && (
            <>
              <Input
                label={t("pay.cardNumber")}
                hint={t("pay.testCard")}
                value={card}
                onChange={(e) => {
                  setCard(e.target.value);
                }}
                autoComplete="off"
                inputMode="numeric"
                maxLength={23}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label={t("pay.expiry")}
                  value={expiry}
                  onChange={(e) => {
                    setExpiry(e.target.value);
                  }}
                  autoComplete="off"
                  inputMode="numeric"
                  maxLength={5}
                />
                <Input
                  label={t("pay.cvv")}
                  value={cvv}
                  onChange={(e) => {
                    setCvv(e.target.value);
                  }}
                  autoComplete="off"
                  inputMode="numeric"
                  type="password"
                  maxLength={4}
                />
              </div>
              {touched && !valid && (
                <p role="alert" className="text-caption font-bold text-danger">
                  {t("errors.api.invalid_request")}
                </p>
              )}
            </>
          )}
          {method === "net" && (
            <Select
              label={t("pay.bank")}
              value={bank}
              onChange={(e) => {
                setBank(e.target.value);
              }}
              error={touched && !valid ? t("errors.api.invalid_request") : undefined}
            >
              <option value="">{t("pay.bankPick")}</option>
              <option value="a">{t("pay.bankA")}</option>
              <option value="b">{t("pay.bankB")}</option>
              <option value="c">{t("pay.bankC")}</option>
            </Select>
          )}
          <Button type="submit">{t("pay.pay", { amount })}</Button>
        </form>
      )}
    </div>
  );
}
