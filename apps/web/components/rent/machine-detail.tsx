import { useLocale, useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format";
import type { MachineName } from "@/components/pictograms/pictogram";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Slot } from "@/lib/domain";
import { filtersToQuery, presetRange, type Filters } from "@/lib/rent";
import type { machineDetail } from "@/server/machines";
import { AvailabilityGrid } from "./availability-grid";
import { BookCard } from "./book-card";
import { BookingChoice } from "./booking-choice";
import { Carousel } from "./carousel";
import { Reviews } from "./reviews";

export type Detail = Awaited<ReturnType<typeof machineDetail>>;

const PICTO: Record<string, MachineName> = {
  tractor: "tractor",
  rotavator: "rotavator",
  seed_drill: "seedDrill",
  sprayer: "sprayer",
  combine_harvester: "combine",
  thresher: "thresher",
  trolley: "trolley",
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** Machine detail (UI-SPEC §4.6). Also the page that sits behind the booking sheet (hideBar). */
export function MachineDetailView({
  m,
  filters,
  today,
  hideBar = false,
}: {
  m: Detail;
  filters: Filters;
  today: string;
  hideBar?: boolean;
}) {
  const t = useTranslations("detail");
  const locale = useLocale();
  const range =
    filters.from && filters.to ? { from: filters.from, to: filters.to } : presetRange("tomorrow", today);
  const slot: Slot = filters.slot;
  const qs = filtersToQuery({ ...filters, from: range.from, to: range.to, view: "list" }).toString();
  const name = m.name;
  const n = (x: number) => formatNumber(x, locale);
  const spec = [
    m.hp ? t("hp", { hp: n(m.hp) }) : null,
    String(m.year),
    m.hourMeter ? t("hours", { n: n(m.hourMeter) }) : null,
  ].filter(Boolean);
  const rating = m.reviewCount > 0 && m.rating !== null;
  const serviced = m.servicedMonth
    ? new Intl.DateTimeFormat(`${locale}-IN`, { month: "short", year: "numeric", timeZone: "UTC" }).format(
        new Date(`${m.servicedMonth}-01T00:00:00Z`),
      )
    : null;
  const ownerLine = [
    m.owner.village,
    m.distanceKm !== undefined ? t("ownerKm", { km: n(m.distanceKm) }) : null,
    m.owner.yearsOnPlatform > 0 ? t("ownerYears", { years: m.owner.yearsOnPlatform }) : t("ownerNew"),
    m.owner.replyMinutes !== null ? t("ownerReply", { min: m.owner.replyMinutes }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <BookingChoice machineId={m.id} baseQs={qs} initial={{ range, slot }}>
      <div className="mx-auto max-w-app pb-6 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-x-8 lg:px-6 lg:pt-6">
        <div className="flex flex-col gap-[18px] lg:col-start-1">
          <Carousel
            photos={m.photos}
            name={name}
            fallback={PICTO[m.category] ?? "tractor"}
            backHref={`/rent/results?${qs}`}
          />
          <div className="flex flex-col gap-[18px] px-4 lg:px-0">
            <h1 className="text-h1">{name}</h1>
            <p className="text-body text-text-muted">{spec.join(" · ")}</p>
            <div className="flex flex-wrap gap-2">
              {m.rcStatus === "checked" && <Badge variant="info">{t("rc")}</Badge>}
              <Badge variant="neutral">
                {rating ? t("reviews", { r: n(m.rating ?? 0), n: m.reviewCount }) : t("ownerNew")}
              </Badge>
              {serviced && <Badge variant="neutral">{t("serviced", { month: serviced })}</Badge>}
              {m.isSample && <Badge variant="sample" />}
            </div>
          </div>
        </div>
        <div className="mt-[18px] px-4 lg:col-start-2 lg:row-span-4 lg:row-start-1 lg:mt-0 lg:px-0">
          <BookCard
            m={{
              priceRupees: m.priceRupees,
              unit: m.unit as "hour" | "acre" | "day",
              altPrice: m.altPrice as { unit: "hour" | "acre" | "day"; rupees: number } | null,
              operatorIncluded: m.operatorIncluded,
              dieselIncluded: m.dieselIncluded,
              attachments: m.attachments,
            }}
            days={m.days14}
            acres={filters.acres}
            hideBar={hideBar}
          />
        </div>
        <section
          className="mt-[18px] flex flex-col gap-3 px-4 lg:col-start-1 lg:px-0"
          aria-labelledby="free-days"
        >
          <h2 id="free-days" className="text-h3">
            {t("freeDays")}
          </h2>
          <div id="availability" tabIndex={-1} className="outline-none">
            <AvailabilityGrid days={m.days14} />
          </div>
          <p className="text-caption text-text-muted">{t("legend")}</p>
        </section>
        <section className="mt-[18px] px-4 lg:col-start-1 lg:px-0">
          <Card className="flex items-center gap-4">
            <span
              aria-hidden
              className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-pill bg-selected text-label text-selected-on"
            >
              {initials(m.owner.shortName)}
            </span>
            <div className="min-w-0">
              <p className="text-h4">{m.owner.shortName}</p>
              <p className="text-small text-text-muted">{ownerLine}</p>
            </div>
          </Card>
        </section>
        <section className="mt-[18px] flex flex-col gap-3 px-4 lg:col-start-1 lg:px-0" aria-labelledby="say">
          <h2 id="say" className="text-h3">
            {t("say")}
          </h2>
          <Reviews machineId={m.id} preview={m.reviewsPreview} count={m.reviewCount} />
        </section>
      </div>
    </BookingChoice>
  );
}
