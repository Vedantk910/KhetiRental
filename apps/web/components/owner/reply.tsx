"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { DECLINE_REASONS } from "@/lib/domain";
import { cn } from "@/lib/utils";

const TICK_MS = 15_000;

/** Milliseconds left until `replyBy`, ticking; at zero the page reloads once so the server marks it expired. */
export function useReplyLeft(replyBy: string | Date) {
  const router = useRouter();
  const end = new Date(replyBy).getTime();
  const [left, setLeft] = useState(() => Math.max(0, end - Date.now()));
  const fired = useRef(false);
  useEffect(() => {
    const tick = () => {
      const l = Math.max(0, end - Date.now());
      setLeft(l);
      if (l === 0) {
        clearInterval(id);
        if (!fired.current) router.refresh();
        fired.current = true;
      }
    };
    const id = setInterval(tick, TICK_MS);
    tick();
    return () => {
      clearInterval(id);
    };
  }, [end, router]);
  return left;
}

/** "Reply in 1 h 40 m", warning colour (UI-SPEC §4.12). */
export function ReplyTimer({ replyBy, className }: { replyBy: string | Date; className?: string }) {
  const t = useTranslations("owner");
  const left = useReplyLeft(replyBy);
  const mins = Math.ceil(left / 60_000);
  const time =
    left === 0
      ? null
      : mins >= 60
        ? t("timeHM", { h: Math.floor(mins / 60), m: mins % 60 })
        : t("timeM", { m: mins });
  return (
    <span className={cn("text-caption font-bold text-warning", className)}>
      {time ? t("replyIn", { time }) : t("timeUp")}
    </span>
  );
}

/** Accept (success fill) and Decline (reason sheet). `onDone` runs after the server says yes. */
export function ReplyButtons({
  bookingId,
  renterFirst,
  onDone,
  className,
}: {
  bookingId: string;
  renterFirst: string;
  onDone?: () => void;
  className?: string;
}) {
  const t = useTranslations("owner");
  const te = useTranslations("errors.api");
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const send = async (kind: "accept" | "decline") => {
    if (busy) return;
    setBusy(kind);
    setError(null);
    try {
      const r = await fetch(`/api/bookings/${bookingId}/${kind}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(kind === "decline" ? { reason } : {}),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { code?: string };
        const code = (["reply_window_closed", "invalid_state", "rate_limited", "forbidden"] as const).find(
          (c) => c === j.code,
        );
        const msg = te(code ?? "internal", { phone: "" });
        setError(msg);
        if (kind === "accept") toast({ tone: "error", message: msg });
        setBusy(null);
        if (code === "reply_window_closed" || code === "invalid_state") router.refresh();
        return;
      }
      toast({
        tone: "success",
        message: kind === "accept" ? t("accepted", { name: renterFirst }) : t("declined"),
      });
      setOpen(false);
      onDone?.();
      router.refresh();
    } catch {
      setError(te("internal", { phone: "" }));
      setBusy(null);
    }
  };

  return (
    <>
      <div className={cn("grid grid-cols-2 gap-2", className)}>
        <Button
          className="min-h-[52px] bg-success text-bg hover:bg-success active:bg-success"
          loading={busy === "accept"}
          onClick={() => void send("accept")}
        >
          {t("accept")}
        </Button>
        <Button
          variant="secondary"
          className="min-h-[52px]"
          onClick={() => {
            setOpen(true);
          }}
        >
          {t("decline")}
        </Button>
      </div>
      {open && (
        <Sheet
          open
          busy={busy === "decline"}
          title={t("declineTitle")}
          onClose={() => {
            setOpen(false);
          }}
        >
          <div className="flex flex-col gap-4">
            <ChipGroup
              label={t("declineTitle")}
              value={reason}
              onChange={setReason}
              options={DECLINE_REASONS.map((r) => ({ value: r, label: t(`declineReasons.${r}`) }))}
            />
            {error && (
              <p role="alert" className="rounded-control bg-danger-bg p-3 text-small text-danger">
                {error}
              </p>
            )}
            <Button
              variant="danger-outline"
              loading={busy === "decline"}
              onClick={() => {
                if (reason) void send("decline");
                else setError(t("declineTitle"));
              }}
            >
              {t("declineSend")}
            </Button>
          </div>
        </Sheet>
      )}
    </>
  );
}
