import { useLocale, useTranslations } from "next-intl";
import { Pictogram, type MachineName } from "@/components/pictograms/pictogram";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Attachment } from "@/lib/domain";
import { Link } from "@/i18n/navigation";
import { formatNumber, formatRupees } from "@/lib/format";
import { fmtShort } from "@/lib/rent";
import { addDays } from "@/server/pricing";
import type { searchMachines } from "@/server/machines";
import { cn } from "@/lib/utils";

export type CardItem = Awaited<ReturnType<typeof searchMachines>>["items"][number];

const PICTO: Record<string, MachineName> = {
  tractor: "tractor",
  rotavator: "rotavator",
  seed_drill: "seedDrill",
  sprayer: "sprayer",
  combine_harvester: "combine",
  thresher: "thresher",
  trolley: "trolley",
};

/** The title line "Swaraj 744 FE + rotavator · 48 HP". */
function useTitle(m: Pick<CardItem, "name" | "attachments" | "hp">) {
  const t = useTranslations();
  const locale = useLocale();
  const parts = [
    m.name,
    ...m.attachments.map((a) => t(`attach.${a as Attachment}`).toLocaleLowerCase(locale)),
  ];
  return parts.join(" + ") + (m.hp ? ` · ${t("detail.hp", { hp: formatNumber(m.hp, locale) })}` : "");
}

function useUnit(m: Pick<CardItem, "unit" | "operatorIncluded">) {
  const t = useTranslations("units");
  return `${t(m.unit as "hour" | "acre" | "day")}${m.operatorIncluded ? ` · ${t("withDriver")}` : ""}`;
}

export function MachinePicture({
  m,
  className,
}: {
  m: Pick<CardItem, "photoUrl" | "category" | "name">;
  className?: string;
}) {
  const t = useTranslations("results");
  return (
    <div
      className={cn("relative flex items-center justify-center bg-border-subtle text-text-subtle", className)}
    >
      {m.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- owner uploads are served by our own route
        <img
          src={m.photoUrl}
          alt={t("photoOf", { name: m.name })}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <Pictogram name={PICTO[m.category] ?? "tractor"} className="h-16 w-16" />
      )}
    </div>
  );
}

/** A free machine (UI-SPEC §4.5.3). The card links to the detail page; Book is its own link on top. */
export function MachineCard({
  m,
  qs,
  from,
  to,
  priority = false,
}: {
  m: CardItem;
  /** The search's own query string, carried to the next page. */
  qs: string;
  from: string | null;
  to: string | null;
  priority?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const title = useTitle(m);
  const unit = useUnit(m);
  const dates = from && to ? fmtShort(from, to, locale) : null;
  const book = dates ? t("results.book", { dates }) : t("detail.book", { dates: "" }).trim();
  const rating = m.reviewCount >= 3 && m.rating !== null;
  const serviced = m.servicedMonth
    ? t("detail.serviced", {
        month: new Intl.DateTimeFormat(`${locale}-IN`, {
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(`${m.servicedMonth}-01T00:00:00Z`)),
      })
    : null;
  return (
    <Card as="article" className="relative overflow-hidden p-0">
      <div className="relative">
        <MachinePicture m={m} className="h-[120px]" />
        {dates && (
          <Badge variant="free" className="absolute left-3 top-3">
            ● {t("results.freeChip", { dates })}
          </Badge>
        )}
        {m.isSample && <Badge variant="sample" className="absolute right-3 top-3" />}
      </div>
      <div className="flex flex-col gap-1 px-[14px] pb-[14px] pt-3">
        <p className="flex items-baseline gap-2">
          <span className="text-price tabular-nums">{formatRupees(m.priceRupees * 100, locale)}</span>
          <span className="text-small text-text-muted">{unit}</span>
        </p>
        <h3 className="text-body">
          <Link
            href={`/rent/m/${m.id}?${qs}`}
            prefetch={false}
            className="flex min-h-tap items-center after:absolute after:inset-0 after:content-['']"
            data-testid="machine-link"
          >
            {title}
          </Link>
        </h3>
        <p className="text-small text-text-muted">
          {t("results.away", { km: formatNumber(m.distanceKm, locale), village: m.village })}
        </p>
        <p className="text-small text-text-muted">
          {rating
            ? `★ ${formatNumber(m.rating ?? 0, locale)} (${formatNumber(m.reviewCount, locale)})`
            : t("results.new")}{" "}
          · {m.ownerShortName}
          {serviced ? ` · ${serviced}` : ""}
        </p>
        <ButtonLink
          href={`/rent/m/${m.id}/book?${qs}&step=1`}
          prefetch={false}
          className="relative z-10 mt-2"
          data-priority={priority || undefined}
          // The visible text first, then which machine: every card's button needs its own name.
          aria-label={`${book}, ${title}`}
        >
          {book}
        </ButtonLink>
      </div>
    </Card>
  );
}

/** A machine that is busy on the chosen dates: name, price, distance and when it is next free. */
export function BusyCard({
  m,
  qs,
  from,
  to,
}: {
  m: CardItem;
  qs: string;
  from: string | null;
  to: string | null;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const title = useTitle(m);
  const unit = useUnit(m);
  // Open the detail page on the next free range of the same length.
  let href = `/rent/m/${m.id}?${qs}`;
  if (m.nextFreeDate && from && to) {
    const n = (Date.parse(to) - Date.parse(from)) / 86_400_000;
    const q = new URLSearchParams(qs);
    q.set("from", m.nextFreeDate);
    q.set("to", addDays(m.nextFreeDate, n));
    href = `/rent/m/${m.id}?${q.toString()}`;
  }
  return (
    <Card variant="busy" as="article" className="relative flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-body font-bold">
          <Link
            href={href}
            prefetch={false}
            className="flex min-h-tap items-center after:absolute after:inset-0 after:content-['']"
          >
            {title}
          </Link>
        </h3>
        <p className="text-small text-text-muted">
          {formatRupees(m.priceRupees * 100, locale)} {unit} · {formatNumber(m.distanceKm, locale)} km
        </p>
      </div>
      {m.nextFreeDate && (
        <p className="shrink-0 text-caption font-bold text-text-muted">
          {t("results.freeFrom", { date: fmtShort(m.nextFreeDate, m.nextFreeDate, locale) })}
        </p>
      )}
    </Card>
  );
}
