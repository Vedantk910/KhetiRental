"use client";

import { LocateFixed } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Pictogram } from "@/components/pictograms/pictogram";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { StickyCTA } from "@/components/ui/sticky-cta";
import { TileGroup } from "@/components/ui/tile";
import { Stepper } from "@/components/ui/stepper";
import { useRouter } from "@/i18n/navigation";
import { JOBS, type Job } from "@/lib/domain";
import {
  clampAcres,
  dayCount,
  filtersToQuery,
  fmtDays,
  MAX_ACRES,
  presetRange,
  type Filters,
  type Range,
} from "@/lib/rent";
import { CallUs } from "./call-us";
import { DateRangeSheet } from "./date-range-sheet";
import { enoughToSearch, PlaceInput, type PlaceOption } from "./place-input";

type When = "tomorrow" | "week" | "pick";
const LAST_COOKIE = "kr_last_search";
const r3 = (n: number) => Math.round(n * 1000) / 1000;

function initialWhen(range: Range | null, today: string): When {
  if (!range) return "tomorrow";
  const t = presetRange("tomorrow", today);
  const w = presetRange("week", today);
  if (range.from === t.from && range.to === t.to) return "tomorrow";
  return range.from === w.from && range.to === w.to ? "week" : "pick";
}

export function SearchForm({ initial, today }: { initial: Filters; today: string }) {
  const t = useTranslations("search");
  const tj = useTranslations("jobs");
  const locale = useLocale();
  const router = useRouter();
  const startRange = initial.from && initial.to ? { from: initial.from, to: initial.to } : null;
  const [job, setJob] = useState<Job | "">(initial.job ?? "");
  const [place, setPlace] = useState(initial.place);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initial.lat !== null && initial.lng !== null ? { lat: initial.lat, lng: initial.lng } : null,
  );
  const [when, setWhen] = useState<When>(initialWhen(startRange, today));
  const [range, setRange] = useState<Range>(startRange ?? presetRange("tomorrow", today));
  const [picking, setPicking] = useState(false);
  const [acres, setAcres] = useState<number | null>(initial.acres);
  const [locating, setLocating] = useState(false);
  const [locateFailed, setLocateFailed] = useState(false);

  const havePlace = enoughToSearch(place) || coords !== null;
  const reason =
    job === "" && !havePlace
      ? t("need")
      : job === ""
        ? t("needWork")
        : !havePlace
          ? t("needPlace")
          : undefined;

  const edit = (text: string) => {
    setPlace(text);
    setCoords(null); // typed text replaces a remembered GPS fix
  };
  const pick = (o: PlaceOption) => {
    setPlace(`${o.pin} · ${o.village}`);
    setCoords({ lat: r3(o.lat), lng: r3(o.lng) });
  };

  const locate = () => {
    setLocateFailed(false);
    if (!("geolocation" in navigator)) {
      setLocateFailed(true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        fetch(`/api/places?lat=${lat}&lng=${lng}`)
          .then((r) => (r.ok ? (r.json() as Promise<{ item: PlaceOption | null }>) : { item: null }))
          .then(({ item }) => {
            setPlace(t("nearYou", { place: item?.village ?? "" }).replace(" ()", ""));
            setCoords({ lat: r3(lat), lng: r3(lng) });
          })
          .catch(() => {
            setLocateFailed(true);
          })
          .finally(() => {
            setLocating(false);
          });
      },
      () => {
        setLocating(false);
        setLocateFailed(true);
      },
      { timeout: 8000 },
    );
  };

  const choose = (w: string) => {
    if (w === "pick") {
      setPicking(true);
      return;
    }
    setWhen(w as When);
    setRange(presetRange(w as "tomorrow" | "week", today));
  };

  const submit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (reason !== undefined || job === "") return;
    // A picked suggestion goes as its PIN (digits before the dot); typed text goes as typed.
    const pin = /^(\d{6}) · /.exec(place)?.[1];
    const f: Filters = {
      ...initial,
      job,
      place: pin ?? place.trim(),
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      from: range.from,
      to: range.to,
      acres,
      view: "list",
    };
    try {
      document.cookie = `${LAST_COOKIE}=${encodeURIComponent(
        JSON.stringify({ job, place: f.place, lat: f.lat, lng: f.lng, acres }),
      )}; path=/; max-age=31536000; samesite=lax`;
    } catch {
      /* cookies blocked: the form still works */
    }
    router.push(`/rent/results?${filtersToQuery(f).toString()}`);
  };

  const n = dayCount(range.from, range.to);
  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-[960px] px-4 pb-6 pt-6 md:px-6 md:pt-8">
      <div className="flex flex-col gap-[22px] md:rounded-card md:border md:border-border-subtle md:bg-surface md:p-8 lg:grid lg:grid-cols-2 lg:gap-x-12">
        <section aria-labelledby="what" className="flex flex-col gap-3">
          <h1 id="what" className="text-h1">
            {t("what")}
          </h1>
          <TileGroup
            label={t("what")}
            value={job}
            onChange={(v) => {
              setJob(v as Job);
            }}
            options={JOBS.map((j) => ({
              value: j,
              label: tj(j),
              icon: <Pictogram name={j} accent={job === j} />,
            }))}
          />
        </section>
        <div className="flex flex-col gap-[22px]">
          <section className="flex flex-col gap-2" aria-labelledby="where">
            <h2 id="where" className="text-label">
              {t("where")}
            </h2>
            <PlaceInput value={place} onText={edit} onPick={pick} />
            <Button type="button" variant="secondary" size="md" loading={locating} onClick={locate}>
              <LocateFixed aria-hidden className="h-5 w-5" />
              {t("locate")}
            </Button>
            <p role="status" className="text-caption text-text-muted empty:hidden">
              {locating ? t("locating") : locateFailed ? t("locateFail") : null}
            </p>
          </section>
          <section className="flex flex-col gap-2" aria-labelledby="when">
            <h2 id="when" className="text-label">
              {t("when")}
            </h2>
            <ChipGroup
              label={t("when")}
              value={when}
              onChange={choose}
              options={[
                { value: "tomorrow", label: t("tomorrow") },
                { value: "week", label: t("week") },
                { value: "pick", label: t("pick") },
              ]}
            />
            <p className="text-small text-text-muted">
              {fmtDays(range.from, range.to, locale)} · {t("days", { n })}
            </p>
          </section>
          <section className="flex flex-col gap-2" aria-labelledby="size">
            <h2 id="size" className="text-label">
              {t("size")} <span className="font-normal text-text-subtle">{t("optional")}</span>
            </h2>
            {acres === null ? (
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    setAcres(2);
                  }}
                >
                  {t("addSize")}
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Stepper
                  label={t("acresLabel")}
                  value={acres}
                  onChange={(v) => {
                    setAcres(clampAcres(v));
                  }}
                  min={0.5}
                  max={MAX_ACRES}
                  step={0.5}
                  decLabel={t("fewerAcres")}
                  incLabel={t("moreAcres")}
                />
                <span className="text-small text-text-muted">{t("acres", { n: acres })}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    setAcres(null);
                  }}
                >
                  {t("removeSize")}
                </Button>
                {acres >= MAX_ACRES && (
                  <p className="basis-full text-caption text-text-muted">
                    <CallUs label={t("tooFar")} className="text-link underline underline-offset-4" />
                  </p>
                )}
              </div>
            )}
          </section>
          <div className="hidden md:block">
            <Button type="submit" disabledReason={reason} className="w-full">
              {t("cta")}
            </Button>
          </div>
        </div>
      </div>
      <div className="md:hidden">
        <StickyCTA>
          <Button type="submit" disabledReason={reason} className="w-full">
            {t("cta")}
          </Button>
        </StickyCTA>
      </div>
      {picking && (
        <DateRangeSheet
          open
          value={range}
          minDay={today}
          onClose={() => {
            setPicking(false);
          }}
          onApply={(r) => {
            setRange(r);
            setWhen("pick");
            setPicking(false);
          }}
        />
      )}
    </form>
  );
}
