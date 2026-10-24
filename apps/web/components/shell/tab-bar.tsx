"use client";

import { CalendarCheck, CircleHelp, Tractor } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { isActive, isAppRoute } from "@/lib/nav";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/rent", key: "rent", Icon: Tractor },
  { href: "/bookings", key: "bookings", Icon: CalendarCheck },
  { href: "/help", key: "help", Icon: CircleHelp },
] as const;

/** Phone/tablet bottom tabs on app routes (renter set). Hidden by CSS while a sticky CTA or sheet is on screen. */
export function TabBar({ preview = false }: { preview?: boolean }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  if (!preview && !isAppRoute(pathname)) return null;
  return (
    <div data-tab-bar className={preview ? undefined : "lg:hidden"}>
      {!preview && <div aria-hidden className="h-16" />}
      <nav
        aria-label={t("tabsLabel")}
        className={cn(
          "border-t border-border-subtle bg-surface",
          !preview && "fixed inset-x-0 bottom-0 z-40",
        )}
      >
        <ul className="mx-auto flex h-16 max-w-app">
          {TABS.map(({ href, key, Icon }) => (
            <li key={href} className="flex-1">
              <Link
                href={href}
                prefetch={false}
                aria-current={isActive(pathname, href) ? "page" : undefined}
                className="flex h-full flex-col items-center justify-center gap-[2px] border-t-[3px] border-transparent text-caption font-bold text-text-muted aria-[current=page]:border-action aria-[current=page]:text-action"
              >
                <Icon aria-hidden className="h-6 w-6" />
                {t(key)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
