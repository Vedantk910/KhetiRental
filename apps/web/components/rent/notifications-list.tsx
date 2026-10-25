"use client";

import { Bell } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const TYPES = [
  "booking_requested",
  "booking_accepted",
  "booking_declined",
  "booking_expired",
  "booking_cancelled",
  "payment_recorded",
  "problem_reported",
] as const;

export interface NotificationItem {
  id: string;
  type: string;
  code: string | null;
  readAt: string | null;
  createdAt: string;
}

/** In-app notifications (UI-SPEC §4.14, D-11): a row each, an unread dot, tap to open the booking. */
export function NotificationsList({ items }: { items: NotificationItem[] }) {
  const t = useTranslations("notif");
  const locale = useLocale();
  const router = useRouter();
  const unread = items.filter((i) => !i.readAt).length;
  const when = new Intl.DateTimeFormat(`${locale}-IN`, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
  const post = (body: object) =>
    fetch("/api/notifications/read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-4 px-4 py-4 pb-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-h2">{t("title")}</h1>
        {unread > 0 && (
          <Button
            variant="ghost"
            size="md"
            onClick={() => {
              void post({ all: true }).then(() => {
                router.refresh();
              });
            }}
          >
            {t("markAll")}
          </Button>
        )}
      </div>
      {items.length === 0 ? (
        <EmptyState icon={<Bell aria-hidden className="h-[40px] w-[40px]" />} title={t("empty")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((n) => {
            const known = (TYPES as readonly string[]).includes(n.type);
            const text = known
              ? t(`type.${n.type as (typeof TYPES)[number]}`, { code: n.code ?? "" })
              : n.type;
            const open = () => {
              if (!n.readAt) void post({ ids: [n.id] });
              if (n.code)
                router.push(
                  n.type === "booking_requested" ? `/owner/requests/${n.code}` : `/bookings/${n.code}`,
                );
            };
            return (
              <Card key={n.id} as="li" className="p-0">
                <button
                  type="button"
                  onClick={open}
                  className="flex min-h-tap w-full items-center gap-3 rounded-card p-4 text-left hover:bg-surface-muted"
                >
                  <span
                    aria-hidden
                    className={cn("h-3 w-3 shrink-0 rounded-pill", n.readAt ? "bg-transparent" : "bg-action")}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className={cn("text-body", !n.readAt && "font-bold")}>{text}</span>
                    <span className="text-caption text-text-subtle">
                      {when.format(new Date(n.createdAt))}
                    </span>
                  </span>
                </button>
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}
