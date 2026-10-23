"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  HP_TIERS,
  SEASONAL_SURGE,
  SEASONS,
  SOILS,
  SOIL_COEFF,
  brokerComparison,
  hourlyRate,
  netHourlyToOwner,
  paybackYears,
  type HpTier,
  type PriceBreakdown,
  type Season,
  type Soil,
} from "@/lib/pricing-engine";

// Broker markup is an unvalidated pilot assumption (docs/PRD.md §1).
const BROKER_MARKUP = 0.38;
const HP_LABEL: Record<HpTier, string> = { "35": "35 HP", "45": "45 HP", "55": "55 HP", "75_4wd": "75 HP 4WD" };
const SEASON_LABEL: Record<Season, string> = { off_season: "Off-season", sowing: "Sowing", harvest_compressed: "Harvest surge" };
const SOIL_LABEL: Record<Soil, string> = { loam: "Alluvial loam", black_cotton: "Black-cotton clay", sandy: "Sandy" };

export const inr = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const field = "mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-fg";

export function PricingCalculator() {
  const [hp, setHp] = useState<HpTier>("45");
  const [season, setSeason] = useState<Season>("harvest_compressed");
  const [soil, setSoil] = useState<Soil>("loam");
  const [age, setAge] = useState(5);
  const [cost, setCost] = useState(640_000);
  const [diesel, setDiesel] = useState("91");

  const result = useMemo(() => {
    try {
      const rate = hourlyRate({ hp, ageYears: age, acquisitionCostInr: cost, soil, season }, Number(diesel));
      const net = netHourlyToOwner(rate);
      return { rate, net, broker: brokerComparison(rate.total, BROKER_MARKUP), error: null };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [hp, season, soil, age, cost, diesel]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <form className="space-y-4 rounded-xl border border-line bg-surface p-5" onSubmit={(e) => e.preventDefault()}>
        <label className="block text-sm font-medium">
          Horsepower tier
          <select className={field} value={hp} onChange={(e) => setHp(e.target.value as HpTier)}>
            {HP_TIERS.map((t) => (
              <option key={t} value={t}>{HP_LABEL[t]}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Season surge (μ = {SEASONAL_SURGE[season].toFixed(2)})
          <select className={field} value={season} onChange={(e) => setSeason(e.target.value as Season)}>
            {SEASONS.map((s) => (
              <option key={s} value={s}>{SEASON_LABEL[s]} (×{SEASONAL_SURGE[s].toFixed(2)})</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Soil type (δ = {SOIL_COEFF[soil].toFixed(2)})
          <select className={field} value={soil} onChange={(e) => setSoil(e.target.value as Soil)}>
            {SOILS.map((s) => (
              <option key={s} value={s}>{SOIL_LABEL[s]} (×{SOIL_COEFF[s].toFixed(2)})</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Tractor age: {age} yr
          <input type="range" min={0} max={10} step={1} value={age} onChange={(e) => setAge(Number(e.target.value))} className="mt-2 w-full accent-[var(--primary)]" />
        </label>
        <label className="block text-sm font-medium">
          Acquisition cost: {inr(cost)}
          <input type="range" min={300_000} max={2_000_000} step={10_000} value={cost} onChange={(e) => setCost(Number(e.target.value))} className="mt-2 w-full accent-[var(--primary)]" />
        </label>
        <label className="block text-sm font-medium">
          Diesel price (₹/L)
          <input type="number" inputMode="decimal" min={1} max={1000} value={diesel} onChange={(e) => setDiesel(e.target.value)} className={field} />
        </label>
      </form>

      <div className="space-y-4">
        {result.error || !("rate" in result) ? (
          <p role="alert" className="rounded-xl border border-soil p-4 text-soil">Check the inputs: {result.error}</p>
        ) : (
          <>
            <RateCard rate={result.rate!} net={result.net!} />
            <p className="text-sm text-muted">
              Farmers pay <span data-testid="broker-savings" className="font-semibold text-fg">{result.broker!.farmerSavingsPct.toFixed(1)}%</span> less
              than through a broker, assuming the broker adds {BROKER_MARKUP * 100}% on top (pilot assumption, not yet surveyed).
            </p>

            <div className="rounded-xl border border-line bg-surface p-5">
              <h3 className="font-semibold">KhetiRental rate vs informal local broker rate (₹/h)</h3>
              <div className="mt-3 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: "KhetiRental", rate: result.rate!.total, fill: "var(--viz-1)" },
                    { name: "Local broker", rate: Math.round(result.broker!.brokerRate * 100) / 100, fill: "var(--muted)" },
                  ]} margin={{ top: 24, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--line)" />
                    <XAxis dataKey="name" stroke="var(--muted)" tickLine={false} />
                    <YAxis stroke="var(--muted)" tickLine={false} axisLine={false} width={48} />
                    <Tooltip cursor={{ fill: "var(--line)", opacity: 0.4 }} formatter={(v) => [inr(Number(v)), "per hour"]} />
                    <Bar dataKey="rate" barSize={56} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      {["k", "b"].map((k, i) => <Cell key={k} fill={i ? "var(--muted)" : "var(--viz-1)"} />)}
                      <LabelList dataKey="rate" position="top" formatter={(v: unknown) => inr(Number(v))} className="fill-[var(--fg)] text-xs" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div data-testid="payback" className="rounded-xl border border-line bg-surface p-5">
              <h3 className="font-semibold">Owner capital payback</h3>
              <p className="mt-2 text-2xl font-bold">
                {paybackYears(cost, result.net!, 250).toFixed(2)} yr <span className="text-muted">at 250 h/yr</span>
                {" → "}
                {paybackYears(cost, result.net!, 620).toFixed(2)} yr <span className="text-muted">at 620 h/yr</span>
              </p>
              <p className="mt-1 text-sm text-muted">Before operator wages, maintenance and insurance, so real payback is longer.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const PARTS = [
  { key: "base", label: "Market rate", hint: "B × μ season × δ soil", color: "var(--viz-1)" },
  { key: "fuel", label: "Diesel pass-through", hint: "F × P diesel, no margin", color: "var(--viz-2)" },
  { key: "wear", label: "Wear recovery", hint: "D wear × κ age", color: "var(--viz-3)" },
] as const;

// The rate as a bill: one stacked bar of its three components, each segment
// direct-labelled so identity never rests on colour alone.
function RateCard({ rate, net }: { rate: PriceBreakdown; net: number }) {
  return (
    <div className="rounded-2xl border-2 border-primary bg-surface p-6">
      <p className="text-sm text-muted">Hourly rate</p>
      <p data-testid="hourly-rate" className="mt-1 text-5xl font-bold tabular-nums tracking-tight">{inr(rate.total)}</p>
      <div className="mt-5 flex h-4 gap-[2px] overflow-hidden rounded" role="img"
        aria-label={PARTS.map((p) => `${p.label} ${inr(rate[p.key])}`).join(", ")}>
        {PARTS.map((p) => (
          <div key={p.key} title={`${p.label}: ${inr(rate[p.key])}`} style={{ flexGrow: rate[p.key], background: p.color }} />
        ))}
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        {PARTS.map((p) => (
          <div key={p.key} className="flex gap-2">
            <span aria-hidden className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: p.color }} />
            <div>
              <dt className="text-sm text-muted">{p.label}</dt>
              <dd className="font-semibold tabular-nums">{inr(rate[p.key])}</dd>
              <dd className="text-xs text-muted">{p.hint}</dd>
            </div>
          </div>
        ))}
      </dl>
      <p className="mt-4 border-t border-line pt-3 text-sm">
        Owner keeps <span className="font-semibold tabular-nums">{inr(net)}</span> per hour after diesel and the 13.5% platform fee.
      </p>
    </div>
  );
}
