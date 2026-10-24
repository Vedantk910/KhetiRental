"use client";

import { useTranslations } from "next-intl";
import { LanguageSwitch } from "@/components/ui/language-switch";
import { Link, usePathname } from "@/i18n/navigation";
import { showFooter } from "@/lib/nav";

const LINKS = [
  { href: "/#story", key: "footer.about" },
  { href: "/how-we-price", key: "footer.pricing" },
  { href: "/about/engineering", key: "footer.built" },
  { href: "/help", key: "nav.help" },
  { href: "/terms", key: "footer.terms" },
  { href: "/privacy", key: "footer.privacy" },
] as const;

export function SiteFooter() {
  const t = useTranslations();
  const pathname = usePathname();
  if (!showFooter(pathname)) return null;
  return (
    <footer className="mt-12 border-t border-border-subtle bg-surface">
      <div className="mx-auto flex max-w-app flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between">
        <nav aria-label={t("footer.label")}>
          <ul className="grid grid-cols-2 gap-x-6 sm:flex sm:flex-wrap">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  prefetch={false}
                  className="flex min-h-tap min-w-tap items-center text-small text-link underline underline-offset-4 hover:no-underline"
                >
                  {t(l.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <LanguageSwitch name="footer" />
      </div>
    </footer>
  );
}
