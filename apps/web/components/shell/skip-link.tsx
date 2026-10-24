import { useTranslations } from "next-intl";

export function SkipLink() {
  const t = useTranslations("common");
  return (
    <a
      href="#main"
      className="sr-only z-[70] rounded-control bg-action px-4 py-3 text-label text-action-on focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:inline-flex focus:min-h-tap focus:items-center"
    >
      {t("skip")}
    </a>
  );
}
