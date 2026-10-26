import { useLocale, useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format";

/** "4 km", or "under 1 km" for the half-kilometre bucket. Usable in server and client components. */
export function useKmText() {
  const t = useTranslations("owner");
  const locale = useLocale();
  return (km: number) => (km < 1 ? t("underKm") : t("km", { km: formatNumber(km, locale) }));
}
