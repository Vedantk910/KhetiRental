"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const YEAR = 60 * 60 * 24 * 365;
const FOCUS_KEY = "kr:lang-focus";

/**
 * मराठी · हिंदी · English (UI-SPEC §3.2). Keeps path, query and hash; remembers the choice in NEXT_LOCALE.
 * `tight`: short labels (म · हि · EN) below 400 px, for the phone header; otherwise below 360 px (§6).
 */
export function LanguageSwitch({
  name,
  tight = false,
  className,
}: {
  /** Unique per page (e.g. "header"); used to put focus back on this switch after the page re-renders. */
  name: string;
  tight?: boolean;
  className?: string;
}) {
  const t = useTranslations("common");
  const current = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const pressed = useRef<HTMLButtonElement>(null);
  // The last language asked for. Clicking fast must compare against this, not the page that is still showing.
  const requested = useRef<string>(current);
  useEffect(() => {
    requested.current = current;
  }, [current]);

  // Switching re-renders the page in the new locale; keep keyboard focus where the user left it.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(FOCUS_KEY) !== name) return;
      sessionStorage.removeItem(FOCUS_KEY);
    } catch {
      return;
    }
    if (document.activeElement === document.body || document.activeElement === null) pressed.current?.focus();
  }, [name, current]);

  const go = (l: Locale) => {
    if (l === requested.current) return;
    requested.current = l;
    try {
      if (document.activeElement?.closest("[data-lang-switch]")) sessionStorage.setItem(FOCUS_KEY, name);
    } catch {
      // storage blocked: focus restore is a nicety
    }
    document.cookie = `NEXT_LOCALE=${l}; path=/; max-age=${YEAR}; samesite=lax`;
    const { search, hash } = window.location;
    startTransition(() => {
      router.replace(`${pathname}${search}${hash}`, { locale: l, scroll: false });
    });
  };

  return (
    <div
      role="group"
      data-lang-switch
      aria-label={t("language")}
      className={cn(
        "inline-flex shrink-0 rounded-pill border-2 border-border-control bg-surface p-[2px]",
        className,
      )}
    >
      {routing.locales.map((l) => (
        <button
          key={l}
          ref={l === current ? pressed : undefined}
          type="button"
          lang={l}
          aria-pressed={l === current}
          onClick={() => {
            go(l);
          }}
          className={cn(
            "min-h-tap min-w-tap rounded-pill px-2 text-label sm:px-3",
            l === current ? "bg-action text-action-on" : "bg-surface text-text hover:bg-surface-muted",
          )}
        >
          <span className={tight ? "max-[399px]:sr-only" : "max-[359px]:sr-only"}>{t(`lang.${l}`)}</span>
          <span aria-hidden className={cn("hidden", tight ? "max-[399px]:inline" : "max-[359px]:inline")}>
            {t(`langShort.${l}`)}
          </span>
        </button>
      ))}
    </div>
  );
}
