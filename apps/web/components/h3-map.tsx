"use client";

import { cellToBoundary, latLngToCell } from "h3-js";
import { CircleCheck, Send, Wrench, type LucideIcon } from "lucide-react";
import { useEffect, useId, useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import {
  DEMO_CENTER,
  DEMO_FLEET,
  EDGE_KM,
  findNear,
  type LatLng,
  type Machine,
  type Res,
} from "@/lib/h3-dispatch";
import { cn } from "@/lib/utils";

export type Status = "available" | "dispatched" | "in_use";
export const STATUS_LABEL: Record<Status, string> = {
  available: "Available",
  dispatched: "Dispatched",
  in_use: "In-use",
};
const STATUS_ICON: Record<Status, LucideIcon> = { available: CircleCheck, dispatched: Send, in_use: Wrench };
const STATUS_COLOR: Record<Status, string> = {
  available: "rgb(var(--success))",
  dispatched: "rgb(var(--info))",
  in_use: "rgb(var(--warning))",
};
const STATUS_LETTER: Record<Status, string> = { available: "A", dispatched: "D", in_use: "U" };
const PATTERN: Status[] = ["available", "available", "dispatched", "available", "in_use"];

export const SANDBOX_TRACTORS: (Machine & { status: Status })[] = DEMO_FLEET.slice(0, 15).map((m, i) => ({
  ...m,
  status: PATTERN[i % PATTERN.length],
}));

const RES_OPTIONS: { res: Res; label: string }[] = [
  { res: 7, label: "Large hexagons, about 1.2 km (Res 7)" },
  { res: 8, label: "Small hexagons, about 460 m (Res 8)" },
  { res: 9, label: "Tiny hexagons, about 174 m (Res 9)" },
];
const PRESETS: { label: string; dx: number; dy: number }[] = [
  { label: "Cluster centre", dx: 0, dy: 0 },
  { label: "North edge of cluster", dx: 0, dy: -3 },
  { label: "East edge of cluster", dx: 3.2, dy: 0 },
  { label: "South-west, sparse", dx: -3.5, dy: 3.5 },
];
const HP_OPTIONS = [35, 45, 55, 75];

// Equirectangular km projection around the demo centre. SVG user units are km, y down.
const KM_LAT = 110.57;
const KM_LNG = 111.32 * Math.cos((DEMO_CENTER.lat * Math.PI) / 180);
const HALF = 6;
const STEP_KM = 0.25;
export const project = (lat: number, lng: number) => ({
  x: (lng - DEMO_CENTER.lng) * KM_LNG,
  y: -(lat - DEMO_CENTER.lat) * KM_LAT,
});
export const pxToLatLng = (x: number, y: number): LatLng => ({
  lat: DEMO_CENTER.lat - y / KM_LAT,
  lng: DEMO_CENTER.lng + x / KM_LNG,
});

const field = "mt-1 w-full rounded-card border border-border-subtle bg-surface px-3 py-2 text-text";
const clampKm = (v: number) => Math.max(-HALF, Math.min(HALF, v));

function StatusBadge({ status }: { status: Status }) {
  const Icon = STATUS_ICON[status];
  return (
    <span className="inline-flex items-center gap-[6px] whitespace-nowrap">
      <Icon aria-hidden className="h-4 w-4" style={{ color: STATUS_COLOR[status] }} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function H3Map() {
  const uid = useId();
  const [res, setRes] = useState<Res>(8);
  const [k, setK] = useState(2);
  const [hp, setHp] = useState(45);
  const [farmer, setFarmer] = useState<LatLng>(DEMO_CENTER);
  const [liveMs, setLiveMs] = useState<number | null>(null);

  const computed = useMemo(() => {
    const available = SANDBOX_TRACTORS.filter((t) => t.status === "available");
    const t0 = performance.now();
    const near = findNear(available, { ...farmer, radiusKm: 5, hp, k, limit: 20, res });
    return { near, ms: performance.now() - t0 };
  }, [farmer, hp, k, res]);
  const { near } = computed;

  // Timing is shown only after mount so server and client HTML match.
  useEffect(() => {
    setLiveMs(computed.ms);
  }, [computed]);

  const hexes = useMemo(
    () =>
      near.ring.map((c) => ({
        c,
        d:
          "M" +
          cellToBoundary(c)
            .map(([la, ln]) => {
              const p = project(la, ln);
              return `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
            })
            .join("L") +
          "Z",
      })),
    [near.ring],
  );
  const rankOf = new Map(near.candidates.map((c, i) => [c.id, i + 1]));
  const f = project(farmer.lat, farmer.lng);
  const offMap = Math.abs(f.x) > HALF || Math.abs(f.y) > HALF;

  const place = (x: number, y: number) => {
    setFarmer(pxToLatLng(clampKm(x), clampKm(y)));
  };
  const onClick = (e: MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (!r.width || !r.height) return;
    place(
      ((e.clientX - r.left) / r.width) * 2 * HALF - HALF,
      ((e.clientY - r.top) / r.height) * 2 * HALF - HALF,
    );
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const d: Partial<Record<string, [number, number]>> = {
      ArrowLeft: [-STEP_KM, 0],
      ArrowRight: [STEP_KM, 0],
      ArrowUp: [0, -STEP_KM],
      ArrowDown: [0, STEP_KM],
    };
    if (e.key === "Home") {
      e.preventDefault();
      setFarmer(DEMO_CENTER);
      return;
    }
    const m = d[e.key];
    if (!m) return;
    e.preventDefault();
    place(f.x + m[0], f.y + m[1]);
  };

  const ringSet = new Set(near.ring);
  const excluded = SANDBOX_TRACTORS.filter(
    (t) => t.status !== "available" && ringSet.has(latLngToCell(t.lat, t.lng, res)),
  ).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <div className="space-y-4">
        <div className="rounded-card border border-border-subtle bg-surface p-3 sm:p-[20px]">
          <svg
            data-testid="h3-map"
            viewBox={`${-HALF} ${-HALF} ${2 * HALF} ${2 * HALF}`}
            role="application"
            tabIndex={0}
            aria-label="Dispatch map. Click or use arrow keys to move the farmer; Home recentres."
            aria-describedby={`${uid}-hint`}
            onClick={onClick}
            onKeyDown={onKey}
            className="aspect-square w-full cursor-crosshair rounded-card border border-border-subtle bg-bg"
          >
            <g aria-hidden>
              {[-4, -2, 0, 2, 4].map((v) => (
                <g key={v} stroke="rgb(var(--border-subtle))" strokeWidth={0.02}>
                  <line x1={v} x2={v} y1={-HALF} y2={HALF} />
                  <line y1={v} y2={v} x1={-HALF} x2={HALF} />
                </g>
              ))}
              {hexes.map(({ c, d }) => (
                <path
                  key={c}
                  data-testid="ring-cell"
                  data-origin={c === near.origin || undefined}
                  d={d}
                  fill={c === near.origin ? "rgb(var(--action))" : "none"}
                  fillOpacity={0.3}
                  stroke={c === near.origin ? "rgb(var(--action))" : "rgb(var(--text-muted))"}
                  strokeOpacity={c === near.origin ? 1 : 0.7}
                  strokeWidth={c === near.origin ? 0.07 : 0.035}
                />
              ))}
              {SANDBOX_TRACTORS.map((t) => {
                const p = project(t.lat, t.lng);
                const rk = rankOf.get(t.id);
                const col = STATUS_COLOR[t.status];
                return (
                  <g key={t.id} transform={`translate(${p.x} ${p.y})`}>
                    {rk && <circle r={0.34} fill="none" stroke="rgb(var(--text))" strokeWidth={0.05} />}
                    {t.status === "available" && <circle r={0.22} fill={col} />}
                    {t.status === "dispatched" && <path d="M0,-0.27 L0.27,0 0,0.27 -0.27,0Z" fill={col} />}
                    {t.status === "in_use" && <rect x={-0.2} y={-0.2} width={0.4} height={0.4} fill={col} />}
                    <text y={0.1} textAnchor="middle" fontSize={0.3} fontWeight={700} fill="#fff">
                      {STATUS_LETTER[t.status]}
                    </text>
                    {rk && (
                      <text x={0.4} y={-0.3} fontSize={0.42} fontWeight={700} fill="rgb(var(--text))">
                        {rk}
                      </text>
                    )}
                  </g>
                );
              })}
              <g
                transform={`translate(${clampKm(f.x)} ${clampKm(f.y)})`}
                stroke="rgb(var(--text))"
                strokeWidth={0.07}
                fill="rgb(var(--surface))"
              >
                <circle r={0.3} />
                <path d="M-0.5,0H0.5M0,-0.5V0.5" fill="none" />
              </g>
            </g>
          </svg>
          <p id={`${uid}-hint`} className="mt-2 text-caption text-text-muted">
            Click the map or focus it and press the arrow keys to place the farmer (cross-hair). Ringed
            numbers are the top-ranked Available tractors. Map spans 12 × 12 km of a synthetic demo cluster.
            {offMap && " Farmer is outside the viewport."}
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-[20px] gap-y-1 text-caption" aria-label="Status legend">
            {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
              <li key={s}>
                <StatusBadge status={s} /> <span className="text-text-muted">({STATUS_LETTER[s]})</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section
            data-testid="latency"
            aria-labelledby={`${uid}-lat`}
            className="rounded-card border border-border-subtle bg-surface p-[20px]"
          >
            <h2 id={`${uid}-lat`} className="font-bold">
              Latency, measured only
            </h2>
            <dl className="mt-3 space-y-3 text-caption">
              <div>
                <dt className="text-text-muted">This browser, this click (gridDisk + rank)</dt>
                <dd data-testid="live-ms" className="text-h2 font-bold tabular-nums">
                  {liveMs === null ? "…" : `${liveMs.toFixed(2)} ms`}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Matching engine under k6, 5,000 VUs</dt>
                <dd className="font-bold tabular-nums">p95 0.66 ms, p99 2.91 ms, 0 % errors</dd>
                <dd className="text-caption text-text-muted">
                  Single Apple-silicon host, k6, service and Redis co-located (showcase/ARCHITECTURE.md,
                  Measured).
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">PostGIS ST_DWithin</dt>
                <dd className="font-bold">Not benchmarked</dd>
                <dd className="text-caption text-text-muted">
                  Never run in this repo, so there is no number to compare against.
                </dd>
              </div>
            </dl>
          </section>

          <section
            aria-labelledby={`${uid}-pipe`}
            className="min-w-0 rounded-card border border-border-subtle bg-surface p-[20px]"
          >
            <h2 id={`${uid}-pipe`} className="font-bold">
              Redis pipeline for this ring
            </h2>
            <p className="mt-1 text-caption text-text-muted">
              {near.pipeline.length} HGETALL commands, one round trip. Each cell is one hash; attributes come
              back inline.
            </p>
            <pre
              data-testid="pipeline"
              // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable block must be keyboard-focusable
              tabIndex={0}
              aria-label="Redis pipeline commands"
              className="mt-3 max-h-[192px] overflow-auto rounded-card border border-border-subtle bg-bg p-3 text-caption leading-5"
            >
              {near.pipeline.join("\n")}
            </pre>
          </section>
        </div>
      </div>

      <div className="space-y-4">
        <form
          className="space-y-4 rounded-card border border-border-subtle bg-surface p-[20px]"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <label className="block text-caption font-bold">
            H3 resolution
            <select
              className={field}
              value={res}
              onChange={(e) => {
                setRes(Number(e.target.value) as Res);
              }}
            >
              {RES_OPTIONS.map((o) => (
                <option key={o.res} value={o.res}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-caption font-bold">
            Rings of neighbours to search: {k}
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={k}
              onChange={(e) => {
                setK(Number(e.target.value));
              }}
              className="mt-2 w-full accent-[rgb(var(--action))]"
            />
          </label>
          <label className="block text-caption font-bold">
            Farmer location
            <select
              className={field}
              value=""
              onChange={(e) => {
                const p = PRESETS[Number(e.target.value)] as (typeof PRESETS)[number] | undefined;
                if (p) place(p.dx, p.dy);
              }}
            >
              <option value="" disabled>
                Choose a preset…
              </option>
              {PRESETS.map((p, i) => (
                <option key={p.label} value={i}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-caption font-bold">
            Horsepower wanted
            <select
              className={field}
              value={hp}
              onChange={(e) => {
                setHp(Number(e.target.value));
              }}
            >
              {HP_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  {h} HP
                </option>
              ))}
            </select>
          </label>
        </form>

        <section aria-live="polite" className="rounded-card border-2 border-action bg-surface p-[20px]">
          <p className="text-caption text-text-muted">Origin cell {near.origin}</p>
          <p className="mt-1 text-caption">
            Ring:{" "}
            <span data-testid="ring-size" className="font-bold tabular-nums">
              {near.ring.length}
            </span>{" "}
            cells
            <span className="text-text-muted">
              {" "}
              = 3k(k+1)+1 at k={near.usedK}, edge ~{EDGE_KM[res] * 1000} m
            </span>
          </p>
          <p className="text-caption text-text-muted">
            Farmer at{" "}
            <span data-testid="farmer-coords" className="tabular-nums">
              {farmer.lat.toFixed(4)}, {farmer.lng.toFixed(4)}
            </span>
          </p>
          <h2 className="mt-3 font-bold">Ranked Available tractors ({near.candidates.length})</h2>
          {near.candidates.length === 0 ? (
            <p className="mt-2 text-caption text-text-muted">
              No Available tractor in this ring. Raise k, pick a coarser resolution or move the farmer toward
              the cluster.
            </p>
          ) : (
            <ol data-testid="results" className="mt-2 space-y-2">
              {near.candidates.map((c, i) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-baseline gap-x-3 border-t border-border-subtle pt-2 text-caption first:border-0 first:pt-0"
                >
                  <span className="w-[20px] font-bold tabular-nums">{i + 1}</span>
                  <span className="whitespace-nowrap font-bold">{c.id}</span>
                  <span className="ml-auto min-w-0 text-right tabular-nums text-text-muted">
                    {c.distKm.toFixed(2)} km, {c.hp} HP, rating {c.reputation.toFixed(2)},{" "}
                    <span className="text-text">score {c.score.toFixed(3)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
          {excluded > 0 && (
            <p className="mt-3 text-caption text-text-muted">
              {excluded} Dispatched or In-use tractor{excluded > 1 ? "s" : ""} in the ring are skipped.
            </p>
          )}
        </section>

        <div className="overflow-x-auto rounded-card border border-border-subtle bg-surface">
          <table aria-label="Simulated tractors" className="w-full text-caption">
            <thead>
              <tr className="text-left text-text-muted">
                <th className="p-2 font-bold">Tractor</th>
                <th className="p-2 font-bold">HP</th>
                <th className="p-2 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {SANDBOX_TRACTORS.map((t) => (
                <tr key={t.id} className={cn("border-t border-border-subtle")}>
                  <td className="p-2 font-bold">{t.id}</td>
                  <td className="p-2 tabular-nums">{t.hp}</td>
                  <td className="p-2">
                    <StatusBadge status={t.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
