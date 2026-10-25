import { useTranslations } from "next-intl";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { BookingStatus } from "@/lib/domain";

const LOOK: Record<BookingStatus, { variant: BadgeVariant; key: string }> = {
  REQUESTED: { variant: "waiting", key: "requested" },
  CONFIRMED: { variant: "confirmed", key: "confirmed" },
  IN_PROGRESS: { variant: "info", key: "inProgress" },
  COMPLETED: { variant: "neutral", key: "completed" },
  CANCELLED: { variant: "busy", key: "cancelled" },
  DECLINED: { variant: "busy", key: "declined" },
  EXPIRED: { variant: "busy", key: "expired" },
};

/** Waiting = warning, confirmed = success, working = info, done = neutral, closed = busy (UI-SPEC §4.9). */
export function StatusBadge({ status }: { status: BookingStatus }) {
  const t = useTranslations("status");
  const l = LOOK[status];
  return <Badge variant={l.variant}>{t(l.key as "requested")}</Badge>;
}
