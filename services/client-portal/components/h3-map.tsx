"use client";

import { cellToBoundary, latLngToCell } from "h3-js";
import { CircleCheck, Send, Wrench, type LucideIcon } from "lucide-react";
import { useEffect, useId, useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import { DEMO_CENTER, DEMO_FLEET, EDGE_KM, findNear, type LatLng, type Machine, type Res } from "@/lib/h3-dispatch";
import { cn } from "@/lib/utils";

export type Status = "available" | "dispatched" | "in_use";
export const STATUS_LABEL: Record<Status, string> = { available: "Available", dispatched: "Dispatched", in_use: "In-use" };
const STATUS_ICON: Record<Status, LucideIcon> = { available: CircleCheck, dispatched: Send, in_use: Wrench };
const STATUS_COLOR: Record<Status, string> = { available: "var(--viz-1)", dispatched: "var(--viz-2)", in_use: "var(--viz-3)" };
const STATUS_LETTER: Record<Status, string> = { available: "A", dispatched: "D", in_use: "U" };
const PATTERN: Status[] = ["available", "available", "dispatched", "available", "in_use"];

export const SANDBOX_TRACTORS: (Machine & { status: Status })[] = DEMO_FLEET.slice(0, 15).map((m, i) => ({
  ...m,
  status: PATTERN[i % PATTERN.length],
}));

const RES_OPTIONS: { res: Res; label: string }[] = [
  { res: 7, label: "Res 7: district, ~1.2 km edge" },
  { res: 8, label: "Res 8: village dispatch, ~460 m edge" },
  { res: 9, label: "Res 9: parcel, ~174 m edge" },
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
export const project = (lat: number, lng: number) => ({ x: (lng - DEMO_CENTER.lng) * KM_LNG, y: -(lat - DEMO_CENTER.lat) * KM_LAT });
export const pxToLatLng = (x: number, y: number): LatLng => ({ lat: DEMO_CENTER.lat - y / KM_LAT, lng: DEMO_CENTER.lng + x / KM_LNG });

const field = "mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-fg";
const clampKm = (v: number) => Math.max(-HALF, Math.min(HALF, v));

function StatusBadge({ status }: { status: Status }) {
  const Icon = STATUS_ICON[status];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
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
  useEffect(() => setLiveMs(computed.ms), [computed]);

  const hexes = useMemo(
    () => near.ring.map((c) => ({ c, d: "M" + cellToBoundary(c).map(([la, ln]) => { const p = project(la, ln); return `${p.x.toFixed(3)},${p.y.toFixed(3)}`; }).join("L") + "Z" })),
    [near.ring],
  );
  const rankOf = new Map(near.candidates.map((c, i) => [c.id, i + 1]));
  const f = project(farmer.lat, farmer.lng);
  const offMap = Math.abs(f.x) > HALF || Math.abs(f.y) > HALF;

  const place = (x: number, y: number) => setFarmer(pxToLatLng(clampKm(x), clampKm(y)));
  const onClick = (e: MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (!r.width || !r.height) return;
    place(((e.clientX - r.left) / r.width) * 2 * HALF - HALF, ((e.clientY - r.top) / r.height) * 2 * HALF - HALF);
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const d: Record<string, [number, number]> = { ArrowLeft: [-STEP_KM, 0], ArrowRight: [STEP_KM, 0], ArrowUp: [0, -STEP_KM], ArrowDown: [0, STEP_KM] };
    if (e.key === "Home") { e.preventDefault(); setFarmer(DEMO_CENTER); return; }
    const m = d[e.key];
    if (!m) return;
    e.preventDefault();
    place(f.x + m[0], f.y + m[1]);
  };

  const ringSet = new Set(near.ring);
  const excluded = SANDBOX_TRACTORS.filter((t) => t.status !== "available" && ringSet.has(latLngToCell(t.lat, t.lng, res))).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-surface p-3 sm:p-5">
          <svg
            data-testid="h3-map"
            viewBox={`${-HALF} ${-HALF} ${2 * HALF} ${2 * HALF}`}
            role="application"
            tabIndex={0}
            aria-label="Dispatch map. Click or use arrow keys to move the farmer; Home recentres."
            aria-describedby={`${uid}-hint`}
            onClick={onClick}
            onKeyDown={onKey}
            className="aspect-square w-full cursor-crosshair rounded-lg border border-line bg-bg"
          >
            <g aria-hidden>
              {[-4, -2, 0, 2, 4].map((v) => (
                <g key={v} stroke="var(--line)" strokeWidth={0.02}>
                  <line x1={v} x2={v} y1={-HALF} y2={HALF} />
                  <line y1={v} y2={v} x1={-HALF} x2={HALF} />
                </g>
              ))}
              {hexes.map(({ c, d }) => (
                <path key={c} data-testid="ring-cell" data-origin={c === near.origin || undefined} d={d}
                  fill={c === near.origin ? "var(--primary)" : "none"} fillOpacity={0.3}
                  stroke={c === near.origin ? "var(--primary)" : "var(--muted)"} strokeOpacity={c === near.origin ? 1 : 0.7} strokeWidth={c === near.origin ? 0.07 : 0.035} />
              ))}
              {SANDBOX_TRACTORS.map((t) => {
                const p = project(t.lat, t.lng);
                const rk = rankOf.get(t.id);
                const col = STATUS_COLOR[t.status];
                return (
                  <g key={t.id} transform={`translate(${p.x} ${p.y})`}>
                    {rk && <circle r={0.34} fill="none" stroke="var(--fg)" strokeWidth={0.05} />}
                    {t.status === "available" && <circle r={0.22} fill={col} />}
                    {t.status === "dispatched" && <path d="M0,-0.27 L0.27,0 0,0.27 -0.27,0Z" fill={col} />}
                    {t.status === "in_use" && <rect x={-0.2} y={-0.2} width={0.4} height={0.4} fill={col} />}
                    <text y={0.1} textAnchor="middle" fontSize={0.3} fontWeight={700} fill="#fff">{STATUS_LETTER[t.status]}</text>
                    {rk && <text x={0.4} y={-0.3} fontSize={0.42} fontWeight={700} fill="var(--fg)">{rk}</text>}
                  </g>
                );
              })}
              <g transform={`translate(${clampKm(f.x)} ${clampKm(f.y)})`} stroke="var(--fg)" strokeWidth={0.07} fill="var(--surface)">
                <circle r={0.3} /><path d="M-0.5,0H0.5M0,-0.5V0.5" fill="none" />
              </g>
            </g>
          </svg>
          <p id={`${uid}-hint`} className="mt-2 text-sm text-muted">
            Click the map or focus it and press the arrow keys to place the farmer (cross-hair). Ringed numbers are the top-ranked Available tractors. Map spans 12 × 12 km of a synthetic demo cluster.
            {offMap && " Farmer is outside the viewport."}
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label="Status legend">
            {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
              <li key={s}><StatusBadge status={s} /> <span className="text-muted">({STATUS_LETTER[s]})</span></li>
            ))}
          </ul>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section data-testid="latency" aria-labelledby={`${uid}-lat`} className="rounded-xl border border-line bg-surface p-5">
            <h3 id={`${uid}-lat`} className="font-semibold">Latency, measured only</h3>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-muted">This browser, this click (gridDisk + rank)</dt>
                <dd data-testid="live-ms" className="text-2xl font-bold tabular-nums">{liveMs === null ? "…" : `${liveMs.toFixed(2)} ms`}</dd>
              </div>
              <div>
                <dt className="text-muted">Matching engine under k6, 5,000 VUs</dt>
                <dd className="font-semibold tabular-nums">p95 0.66 ms, p99 2.91 ms, 0 % errors</dd>
                <dd className="text-xs text-muted">Single Apple-silicon host, k6, service and Redis co-located (ARCHITECTURE.md, Measured).</dd>
              </div>
              <div>
                <dt className="text-muted">PostGIS ST_DWithin</dt>
                <dd className="font-semibold">Not benchmarked</dd>
                <dd className="text-xs text-muted">Never run in this repo, so there is no number to compare against.</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby={`${uid}-pipe`} className="min-w-0 rounded-xl border border-line bg-surface p-5">
            <h3 id={`${uid}-pipe`} className="font-semibold">Redis pipeline for this ring</h3>
            <p className="mt-1 text-sm text-muted">{near.pipeline.length} HGETALL commands, one round trip. Each cell is one hash; attributes come back inline.</p>
            <pre data-testid="pipeline" tabIndex={0} aria-label="Redis pipeline commands" className="mt-3 max-h-48 overflow-auto rounded-md border border-line bg-bg p-3 text-xs leading-5">
              {near.pipeline.join("\n")}
            </pre>
          </section>
        </div>
      </div>

      <div className="space-y-4">
        <form className="space-y-4 rounded-xl border border-line bg-surface p-5" onSubmit={(e) => e.preventDefault()}>
          <label className="block text-sm font-medium">
            H3 resolution
            <select className={field} value={res} onChange={(e) => setRes(Number(e.target.value) as Res)}>
              {RES_OPTIONS.map((o) => <option key={o.res} value={o.res}>{o.label}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">
            K-ring depth: {k}
            <input type="range" min={1} max={5} step={1} value={k} onChange={(e) => setK(Number(e.target.value))} className="mt-2 w-full accent-[var(--primary)]" />
          </label>
          <label className="block text-sm font-medium">
            Farmer location
            <select className={field} value="" onChange={(e) => { const p = PRESETS[Number(e.target.value)]; if (p) place(p.dx, p.dy); }}>
              <option value="" disabled>Choose a preset…</option>
              {PRESETS.map((p, i) => <option key={p.label} value={i}>{p.label}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Horsepower wanted
            <select className={field} value={hp} onChange={(e) => setHp(Number(e.target.value))}>
              {HP_OPTIONS.map((h) => <option key={h} value={h}>{h} HP</option>)}
            </select>
          </label>
        </form>

        <section aria-live="polite" className="rounded-xl border-2 border-primary bg-surface p-5">
          <p className="text-sm text-muted">Origin cell {near.origin}</p>
          <p className="mt-1 text-sm">
            Ring: <span data-testid="ring-size" className="font-bold tabular-nums">{near.ring.length}</span> cells
            <span className="text-muted"> = 3k(k+1)+1 at k={near.usedK}, edge ~{EDGE_KM[res] * 1000} m</span>
          </p>
          <p className="text-sm text-muted">Farmer at <span data-testid="farmer-coords" className="tabular-nums">{farmer.lat.toFixed(4)}, {farmer.lng.toFixed(4)}</span></p>
          <h3 className="mt-3 font-semibold">Ranked Available tractors ({near.candidates.length})</h3>
          {near.candidates.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No Available tractor in this ring. Raise k, pick a coarser resolution or move the farmer toward the cluster.</p>
          ) : (
            <ol data-testid="results" className="mt-2 space-y-2">
              {near.candidates.map((c, i) => (
                <li key={c.id} className="flex flex-wrap items-baseline gap-x-3 border-t border-line pt-2 text-sm first:border-0 first:pt-0">
                  <span className="w-5 font-bold tabular-nums">{i + 1}</span>
                  <span className="whitespace-nowrap font-semibold">{c.id}</span>
                  <span className="ml-auto min-w-0 text-right tabular-nums text-muted">
                    {c.distKm.toFixed(2)} km, {c.hp} HP, rating {c.reputation.toFixed(2)}, <span className="text-fg">score {c.score.toFixed(3)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
          {excluded > 0 && <p className="mt-3 text-xs text-muted">{excluded} Dispatched or In-use tractor{excluded > 1 ? "s" : ""} in the ring are skipped.</p>}
        </section>

        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table aria-label="Simulated tractors" className="w-full text-sm">
            <thead><tr className="text-left text-muted"><th className="p-2 font-medium">Tractor</th><th className="p-2 font-medium">HP</th><th className="p-2 font-medium">Status</th></tr></thead>
            <tbody>
              {SANDBOX_TRACTORS.map((t) => (
                <tr key={t.id} className={cn("border-t border-line")}>
                  <td className="p-2 font-medium">{t.id}</td><td className="p-2 tabular-nums">{t.hp}</td><td className="p-2"><StatusBadge status={t.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
