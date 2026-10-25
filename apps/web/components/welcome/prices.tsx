import { useLocale, useTranslations } from "next-intl";
import { COMPONENTS, type ComponentKey } from "@/config/welcome";
import { formatRupees } from "@/lib/format";

/** One component of the S2 picture with its prices already formatted for the page's language. */
export type Part = { key: ComponentKey; name: string; buy: string; rent: string };

export function useParts(): Part[] {
  const tm = useTranslations("machines");
  const tu = useTranslations("units");
  const locale = useLocale();
  const rupees = (n: number) => formatRupees(n * 100, locale);
  return COMPONENTS.map((c) => ({
    key: c.key,
    name: tm(c.key),
    buy: rupees(c.buy),
    rent: `${rupees(c.rent)} ${tu(c.per)}`,
  }));
}

/** "Buy ₹1,10,000 · Rent ₹400 / hour", used by the plain list and by the tags on the 3D scene. */
export function PriceLine({ part }: { part: Part }) {
  const t = useTranslations("story.s2");
  return (
    <>
      {t("tagBuy")} <b>{part.buy}</b> · {t("tagRent")} <b>{part.rent}</b>
    </>
  );
}
