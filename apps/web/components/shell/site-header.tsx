"use client";

import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { Pictogram } from "@/components/pictograms/pictogram";
import { LanguageSwitch } from "@/components/ui/language-switch";
import { Link, usePathname } from "@/i18n/navigation";
import { isActive } from "@/lib/nav";

const NAV = [
  { href: "/rent", key: "rent" },
  { href: "/bookings", key: "bookings" },
  { href: "/help", key: "help" },
] as const;

/** Phone/tablet: 56 px bar with logo, bell, language. From 1024 px: 64 px with the top nav (UI-SPEC §3.2). */
export function SiteHeader() {
  const t = useTranslations();
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-surface">
      <div className="mx-auto flex h-[56px] max-w-app items-center gap-2 px-4 sm:px-6 lg:h-16 lg:gap-6">
        <Link
          href="/"
          className="flex min-h-tap shrink-0 items-center gap-2 rounded-control text-[1.25rem] font-bold leading-7 text-text"
        >
          <Pictogram name="tractor" accent className="hidden sm:block" />
          {t("common.brand")}
        </Link>
        <nav aria-label={t("nav.label")} className="hidden lg:block">
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
          <Link
            href="/notifications"
            aria-label={t("nav.notifications")}
            className="flex h-tap w-tap shrink-0 items-center justify-center rounded-pill text-text hover:bg-surface-muted"
          >
            <Bell aria-hidden className="h-6 w-6" />
          </Link>
          <LanguageSwitch name="header" tight />
        </div>
      </div>
    </header>
  );
}
