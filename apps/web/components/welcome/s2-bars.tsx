import { useLocale, useTranslations } from "next-intl";
import { formatRupees } from "@/lib/format";

export const BUY_RUPEES = 640_000;
export const RENT_RUPEES = 2839;

/** Buy is the full width; rent is its true share, but never thinner than a 12 px stub so it stays visible. */
export const barWidth = (rupees: number) => `max(12px, ${(rupees / BUY_RUPEES) * 100}%)`;

export function S2Bars() {
  const t = useTranslations("story");
  const locale = useLocale();
  const rupees = (n: number) => formatRupees(n * 100, locale);
  return (
    <>
      <div>
        <div className="flex justify-between text-small">
          <span>{t("s2.buy")}</span>
          <strong>{rupees(BUY_RUPEES)}</strong>
        </div>
        <div
          className="kr-grow mt-[6px] h-[18px] rounded-[9px] bg-[#483F37]"
          style={{ width: barWidth(BUY_RUPEES) }}
        />
      </div>
      <div>
        <div className="flex justify-between text-small">
          <span>{t("s2.rent")}</span>
          <strong className="text-success">{rupees(RENT_RUPEES)}</strong>
        </div>
        <div
          className="kr-grow mt-[6px] h-[18px] rounded-[9px] bg-success"
          style={{ width: barWidth(RENT_RUPEES) }}
        />
      </div>
    </>
  );
}
