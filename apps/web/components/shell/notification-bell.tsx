"use client";

import { Bell } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { isAppRoute } from "@/lib/nav";

/** The header bell, with the unread count on app pages (where a login is certain, so no 401 noise elsewhere). */
export function NotificationBell({ overlay = false }: { overlay?: boolean }) {
  const t = useTranslations();
  const format = useFormatter();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const app = isAppRoute(pathname);

  useEffect(() => {
    if (!app) {
      setUnread(0);
      return;
    }
    let live = true;
    const load = () => {
      fetch("/api/notifications")
        .then((r) => (r.ok ? (r.json() as Promise<{ unread: number }>) : null))
        .then((j) => {
          if (live && j) setUnread(j.unread);
        })
        .catch(() => undefined);
    };
    load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [app, pathname]);

  if (overlay) return null;
  return (
    <Link
      href="/notifications"
      aria-label={
        unread > 0 ? `${t("nav.notifications")}: ${t("notif.unread", { n: unread })}` : t("nav.notifications")
      }
      className="relative flex h-tap w-tap shrink-0 items-center justify-center rounded-pill text-text hover:bg-surface-muted"
    >
      <Bell aria-hidden className="h-6 w-6" />
      {unread > 0 && (
        <span
          aria-hidden
          data-testid="bell-count"
          className="absolute right-1 top-1 flex h-[20px] min-w-[20px] items-center justify-center rounded-pill bg-danger px-1 text-[0.6875rem] font-bold leading-none text-bg"
        >
          {/* Same digits as the label (Devanagari in mr), so the visible text matches the spoken name. */}
          {unread > 9 ? `${format.number(9)}+` : format.number(unread)}
        </span>
      )}
    </Link>
  );
}
