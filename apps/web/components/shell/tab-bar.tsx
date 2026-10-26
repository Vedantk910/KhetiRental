"use client";

import { CalendarCheck, CircleHelp, LayoutDashboard, Settings, Tractor, Warehouse } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { isActive, isAppRoute } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useRoles } from "./use-roles";

const HELP = { href: "/help", key: "help", Icon: CircleHelp } as const;
// Settings holds Log out, so every set ends with it.
const SETTINGS = { href: "/settings", key: "settings", Icon: Settings } as const;
const RENTER = [
  { href: "/rent", key: "rent", Icon: Tractor },
  { href: "/bookings", key: "bookings", Icon: CalendarCheck },
  HELP,
  SETTINGS,
] as const;
const OWNER_ONLY = [
  { href: "/owner", key: "dashboard", Icon: LayoutDashboard },
  { href: "/owner#machines", key: "machines", Icon: Warehouse },
  HELP,
  SETTINGS,
] as const;
/** "My machines" shares the dashboard page, so it is active on the wizard pages only. */
const current = (pathname: string, href: string) =>
  href === "/owner#machines"
    ? isActive(pathname, "/owner/machines")
    : href === "/owner"
      ? isActive(pathname, "/owner") && !isActive(pathname, "/owner/machines")
      : isActive(pathname, href);
const OWNER_TAB = { href: "/owner", key: "owner", Icon: LayoutDashboard } as const;

/** Phone/tablet bottom tabs on app routes (renter set). Hidden by CSS while a sticky CTA or sheet is on screen. */
export function TabBar({ preview = false }: { preview?: boolean }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const roles = useRoles();
  if (!preview && !isAppRoute(pathname)) return null;
  // Owner-only accounts get the owner set; renters who also own get an Owner tab (UI-SPEC §3.2).
  const ownerOnly = roles
    ? roles.includes("owner") && !roles.includes("renter")
    : isActive(pathname, "/owner");
  const tabs = ownerOnly
    ? OWNER_ONLY
    : roles?.includes("owner")
      ? [...RENTER.slice(0, 2), OWNER_TAB, HELP, SETTINGS]
      : RENTER;
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
          {tabs.map(({ href, key, Icon }) => (
            <li key={href} className="flex-1">
              <Link
                href={href}
                prefetch={false}
                aria-current={current(pathname, href) ? "page" : undefined}
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
