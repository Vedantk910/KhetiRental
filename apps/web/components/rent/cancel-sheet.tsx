"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";

const REASONS = ["plans", "found", "price", "other"] as const;

/** "Cancel" with its confirmation sheet: the refund line, an optional reason, Yes / Keep (UI-SPEC §4.8). */
export function CancelButton({
  bookingId,
  cancelDeadline,
  className,
  size = "lg",
}: {
  bookingId: string;
  cancelDeadline: string;
  className?: string;
  size?: "lg" | "md";
}) {
  const t = useTranslations("bookings");
  const tc = useTranslations("cancel");
  const te = useTranslations("errors.api");
  const tr = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deadline = new Date(cancelDeadline);
  const deadlineText = new Intl.DateTimeFormat(`${locale}-IN`, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(deadline);

  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(reason ? { reason } : {}),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { code?: string };
        setError(te(j.code === "invalid_state" ? "invalid_state" : "internal", { phone: "" }));
        setBusy(false);
        return;
      }
      toast({ tone: "success", message: t("cancelledToast") });
      setOpen(false);
      router.refresh();
    } catch {
      setError(tr("network"));
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="danger-outline"
        size={size}
        className={className}
        onClick={() => {
          setOpen(true);
        }}
      >
        {t("cancel")}
      </Button>
      {open && (
        <Sheet
          open
          busy={busy}
          title={tc("title")}
          onClose={() => {
            setOpen(false);
          }}
        >
          <div className="flex flex-col gap-4">
            <p className="text-body">
              {Date.now() <= deadline.getTime()
                ? t("cancelFree", { deadline: deadlineText })
                : t("cancelNow")}
            </p>
            <div className="flex flex-col gap-2">
              <p className="text-label">{t("reasonLabel")}</p>
              <ChipGroup
                label={t("reasonLabel")}
                value={reason}
                onChange={setReason}
                options={REASONS.map((r) => ({ value: r, label: t(`reasons.${r}`) }))}
              />
            </div>
            {error && (
              <p role="alert" className="rounded-control bg-danger-bg p-3 text-small text-danger">
                {error}
              </p>
            )}
            <Button variant="danger-outline" loading={busy} onClick={() => void cancel()}>
              {tc("yes")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setOpen(false);
              }}
            >
              {tc("keep")}
            </Button>
          </div>
        </Sheet>
      )}
    </>
  );
}
