"use client";

import { ArrowLeft, ChevronDown, Map as MapIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet } from "@/components/ui/sheet";
import { Link, useRouter } from "@/i18n/navigation";
import { RADII_KM, SORTS } from "@/lib/domain";
import { apiParams, filtersToQuery, fmtShort, type Filters } from "@/lib/rent";
import { cn } from "@/lib/utils";
import { CallUs } from "./call-us";
import { BusyCard, MachineCard } from "./machine-card";
import type { MapItem } from "./results-map";

const ResultsMap = dynamic(() => import("./results-map"), { ssr: false });

export interface Page {
  items: MapItem[];
  total: number;
  freeTotal: number;
  nextCursor: string | null;
  place: { label: string | null; center?: { lat: number; lng: number } };
}

const SORT_KEY = { nearest: "nearest", cheapest: "cheapest", top_rated: "top" } as const;
const chip =
  "inline-flex h-9 items-center gap-1 rounded-pill border-2 px-3 text-caption font-bold transition-colors duration-[120ms]";

export function ResultsView({ initial, filters: f }: { initial: Page; filters: Filters }) {
  const t = useTranslations("results");
  const tj = useTranslations("jobs");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [freeTotal, setFreeTotal] = useState(initial.freeTotal);
  const [total, setTotal] = useState(initial.total);
  const [more, setMore] = useState<"idle" | "loading" | "error">("idle");
  const [radiusOpen, setRadiusOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const menu = useRef<HTMLDivElement>(null);

  const base = filtersToQuery({ ...f, view: "list" }).toString();
  const place = initial.place.label ?? f.place;

  const go = (patch: Partial<Filters>) => {
    start(() => {
      router.replace(`/rent/results?${filtersToQuery({ ...f, ...patch }).toString()}`);
    });
  };

  useEffect(() => {
    if (!radiusOpen) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menu.current?.contains(e.target as Node))
        setRadiusOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [radiusOpen]);

  const loadMore = async () => {
    if (!cursor || more === "loading") return;
    setMore("loading");
    try {
      const extra: Record<string, string> = { cursor };
      if (f.view === "map") extra.map = "1";
      const r = await fetch(`/api/machines?${apiParams(f, extra).toString()}`);
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as Page;
      setItems((xs) => [...xs, ...j.items]);
      setCursor(j.nextCursor);
      setFreeTotal(j.freeTotal);
      setTotal(j.total);
      setMore("idle");
    } catch {
      setMore("error");
    }
  };
  // Back online: retry the failed page by itself.
  useEffect(() => {
    if (more !== "error") return;
    const on = () => {
      void loadMore();
    };
    window.addEventListener("online", on);
    return () => {
      window.removeEventListener("online", on);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [more]);

  const free = items.filter((m) => m.available);
  const busy = items.filter((m) => !m.available);
  const hasDates = f.from !== null && f.to !== null;
  const dates = hasDates ? fmtShort(f.from ?? "", f.to ?? "", locale) : "";
  const sortWord = t(`sortWord.${SORT_KEY[f.sort]}`);
  const mapMode = f.view === "map";
  const selectedItem = items.find((m) => m.id === selected) ?? null;

  const list = (
    <div className={cn("flex flex-col gap-4", mapMode && "hidden lg:flex")}>
      <h2 className="sr-only">{t("listLabel")}</h2>
      {free.length === 0 ? (
        <EmptyState
          title={t("empty", { km: f.radius })}
          actions={
            <>
              {f.radius < 25 && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    go({ radius: 25 });
                  }}
                >
                  {t("wider")}
                </Button>
              )}
              <Link
                href={`/rent?${base}`}
                className="inline-flex min-h-tap items-center text-link underline underline-offset-4"
              >
                {t("otherDates")}
              </Link>
              <CallUs
                label={t("callUs")}
                className="inline-flex min-h-tap items-center text-link underline underline-offset-4"
              />
            </>
          }
        />
      ) : (
        <ul className={cn("grid gap-4", !mapMode && "xl:grid-cols-2")} aria-label={t("listLabel")}>
          {free.map((m) => (
            <li key={m.id}>
              <MachineCard m={m} qs={base} from={f.from} to={f.to} />
            </li>
          ))}
        </ul>
      )}
      {busy.length > 0 && (
        <>
          <div role="separator" className="flex items-center gap-3 text-caption font-bold text-text-subtle">
            <span className="h-px flex-1 bg-chip" />
            {t("busy")}
            <span className="h-px flex-1 bg-chip" />
          </div>
          <ul className="grid gap-3">
            {busy.map((m) => (
              <li key={m.id}>
                <BusyCard m={m} qs={base} from={f.from} to={f.to} />
              </li>
            ))}
          </ul>
        </>
      )}
      {more === "error" && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-card bg-danger-bg p-4 text-small text-danger"
        >
          <p className="flex-1">{t("error")}</p>
          <Button variant="secondary" size="md" onClick={() => void loadMore()}>
            {tc("tryAgain")}
          </Button>
        </div>
      )}
      {items.length < total && (
        <>
          <p className="text-center text-small text-text-muted">
            {t("showing", { shown: items.length, total })}
          </p>
          {cursor && (
            <Button variant="secondary" loading={more === "loading"} onClick={() => void loadMore()}>
              {t("more")}
            </Button>
          )}
        </>
      )}
      <p className="pt-2 text-center text-small text-text-muted">
        {t("notFinding")}{" "}
        {f.radius < 25 && (
          <>
            <button
              type="button"
              onClick={() => {
                go({ radius: 25 });
              }}
              className="inline-flex min-h-tap items-center font-bold text-link underline underline-offset-4"
            >
              {t("wider")}
            </button>{" "}
            {t("orSep")}{" "}
          </>
        )}
        <CallUs
          label={t("callUs")}
          className="inline-flex min-h-tap items-center font-bold text-link underline underline-offset-4"
        />
      </p>
    </div>
  );

  return (
    <div aria-busy={pending || undefined} className={cn(pending && "opacity-60 transition-opacity")}>
      <h1 className="sr-only">{f.job ? tj(f.job) : t("anyJob")}</h1>
      <div className="sticky top-[56px] z-30 border-b border-border-subtle bg-surface lg:top-16">
        <div className="mx-auto flex max-w-app flex-col gap-2 px-4 pb-3 pt-[10px] sm:px-6">
          <div className="flex items-center gap-[10px]">
            <Link
              href={`/rent?${base}`}
              aria-label={t("back")}
              className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-control text-text hover:bg-surface-muted"
            >
              <ArrowLeft aria-hidden className="h-6 w-6" />
            </Link>
            <Link
              href={`/rent?${base}`}
              className="min-w-0 flex-1 rounded-control border-2 border-chip px-3 py-2 text-small"
            >
              <strong>{f.job ? tj(f.job) : t("anyJob")}</strong>
              {hasDates ? ` · ${dates}` : ""} · {place} ·{" "}
              <span className="font-bold text-link">{t("change")}</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <ChipGroup
              label={t("sortLabel")}
              value={f.sort}
              onChange={(v) => {
                go({ sort: v as Filters["sort"] });
              }}
              options={SORTS.map((s) => ({ value: s, label: t(`sort.${SORT_KEY[s]}`) }))}
              className="flex-nowrap overflow-x-auto [&>button]:whitespace-nowrap [&>button]:px-3"
            />
            <button
              type="button"
              aria-pressed={mapMode}
              onClick={() => {
                go({ view: mapMode ? "list" : "map" });
              }}
              className={cn(
                "ml-auto flex min-h-tap shrink-0 items-center gap-1 rounded-pill border-2 px-3 text-label",
                mapMode ? "border-action bg-selected text-selected-on" : "border-chip bg-surface",
              )}
            >
              <MapIcon aria-hidden className="h-5 w-5" />
              {mapMode ? t("list") : t("map")}
            </button>
          </div>
          <div className="relative flex gap-2" ref={menu}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={radiusOpen}
              aria-label={`${t("radius", { km: f.radius })}, ${t("radiusLabel")}`}
              onClick={() => {
                setRadiusOpen((o) => !o);
              }}
              className="flex h-tap items-center"
            >
              <span className={cn(chip, "border-chip bg-surface")}>
                {t("radius", { km: f.radius })}
                <ChevronDown aria-hidden className="h-4 w-4" />
              </span>
            </button>
            <button
              type="button"
              aria-pressed={f.driver}
              onClick={() => {
                go({ driver: !f.driver });
              }}
              className="flex h-tap items-center"
            >
              <span
                className={cn(
                  chip,
                  f.driver ? "border-action bg-selected text-selected-on" : "border-chip bg-surface",
                )}
              >
                {t("withDriver")}
              </span>
            </button>
            {radiusOpen && (
              <div
                role="menu"
                aria-label={t("radiusLabel")}
                className="absolute left-0 top-full z-40 min-w-[160px] overflow-hidden rounded-control border-2 border-border-control bg-surface shadow-sheet"
              >
                {RADII_KM.map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="menuitemradio"
                    aria-checked={f.radius === r}
                    onClick={() => {
                      setRadiusOpen(false);
                      go({ radius: r });
                    }}
                    className={cn(
                      "flex min-h-tap w-full items-center px-4 text-label hover:bg-surface-muted",
                      f.radius === r && "bg-selected text-selected-on",
                    )}
                  >
                    {t("radius", { km: r })}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-app px-4 py-4 sm:px-6">
        <p aria-live="polite" className="mb-3 text-small text-text-muted">
          {hasDates
            ? t("count", { n: freeTotal, sort: sortWord })
            : t("countNoDates", { n: total, sort: sortWord })}
        </p>
        <div className={cn(mapMode && "lg:grid lg:grid-cols-2 lg:gap-6")}>
          {list}
          {mapMode && (
            <div className="lg:sticky lg:top-[200px] lg:self-start">
              <ResultsMap
                items={items}
                center={initial.place.center ?? null}
                selected={selected}
                onSelect={setSelected}
                onSearchArea={(c) => {
                  go({ lat: c.lat, lng: c.lng, place: t("searchArea") });
                }}
              />
            </div>
          )}
        </div>
      </div>
      {selectedItem && (
        <Sheet
          open
          title={selectedItem.name}
          onClose={() => {
            setSelected(null);
          }}
        >
          <MachineCard m={selectedItem} qs={base} from={f.from} to={f.to} />
        </Sheet>
      )}
    </div>
  );
}
