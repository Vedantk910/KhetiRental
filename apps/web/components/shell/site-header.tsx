"use client";

import { useTranslations } from "next-intl";
import { Pictogram } from "@/components/pictograms/pictogram";
import { NotificationBell } from "@/components/shell/notification-bell";
import { LanguageSwitch } from "@/components/ui/language-switch";
import { Link, usePathname } from "@/i18n/navigation";
import { isActive } from "@/lib/nav";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/rent", key: "rent" },
  { href: "/bookings", key: "bookings" },
  { href: "/help", key: "help" },
] as const;

/** Phone/tablet: 56 px bar with logo, bell, language. From 1024 px: 64 px with the top nav (UI-SPEC §3.2). */
export function SiteHeader() {
  const t = useTranslations();
  const pathname = usePathname();
  // The login pages draw their own back arrow and language switch.
  if (isActive(pathname, "/login")) return null;
  // Welcome page: floats transparent over the field scene (UI-SPEC §4.1.1).
  const overlay = pathname === "/";
  return (
    <header
      className={
        overlay
          ? "absolute inset-x-0 top-0 z-40"
          : "sticky top-0 z-40 border-b border-border-subtle bg-surface"
      }
    >
      <div
        className={cn(
          "mx-auto flex max-w-app items-center gap-1 px-4 min-[360px]:gap-2 sm:px-6 lg:gap-6",
          overlay ? "py-3 lg:px-6" : "h-[56px] lg:h-16",
        )}
      >
        <Link
          href="/"
          className={cn(
            "flex min-h-tap shrink-0 items-center gap-2 rounded-control text-[1.125rem] font-bold leading-7 text-text min-[360px]:text-[1.25rem]",
            overlay && "rounded-pill bg-white/85 px-3 text-[#13100D]",
          )}
        >
          <Pictogram name="tractor" accent className="hidden sm:block" />
          {t("common.brand")}
        </Link>
        <nav aria-label={t("nav.label")} className={cn("hidden", !overlay && "lg:block")}>
          <ul className="flex items-center gap-1">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  prefetch={false}
                  aria-current={isActive(pathname, n.href) ? "page" : undefined}
                  className="flex min-h-tap min-w-tap items-center justify-center border-b-[3px] border-transparent px-3 text-label text-text-muted hover:text-text aria-[current=page]:border-action aria-[current=page]:text-action"
                >
                  {t(`nav.${n.key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <NotificationBell overlay={overlay} />
          <LanguageSwitch name="header" tight />
        </div>
      </div>
    </header>
  );
}
