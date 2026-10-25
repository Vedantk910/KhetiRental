"use client";

import { useMemo, useRef, useState } from "react";
import { BarList } from "@/components/engineering/bar-list";
import { formatInr2 } from "@/lib/format";
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

// Broker markup is an unvalidated pilot assumption (showcase/docs/PRD.md §1).
const BROKER_MARKUP = 0.38;
const HP_LABEL: Record<HpTier, string> = {
  "35": "35 HP",
  "45": "45 HP",
  "55": "55 HP",
  "75_4wd": "75 HP 4WD",
};
const SEASON_LABEL: Record<Season, string> = {
  off_season: "Off-season",
  sowing: "Sowing",
  harvest_compressed: "Harvest surge",
};
const SOIL_LABEL: Record<Soil, string> = {
  loam: "Alluvial loam",
  black_cotton: "Black-cotton clay",
  sandy: "Sandy",
};

const field = "mt-1 w-full rounded-card border border-border-subtle bg-surface px-3 py-2 text-text";

export function PricingCalculator() {
  const [hp, setHp] = useState<HpTier>("45");
  const [season, setSeason] = useState<Season>("harvest_compressed");
  const [soil, setSoil] = useState<Soil>("loam");
  const [age, setAge] = useState(5);
  const [cost, setCost] = useState(640_000);
  const [diesel, setDiesel] = useState("91");

  const dieselNum = Number(diesel);
  const dieselBad = diesel.trim() === "" || !(dieselNum >= 1 && dieselNum <= 1000);
  // While the field is invalid the results keep the last good price instead of flashing an error.
  const lastGood = useRef(91);
  if (!dieselBad) lastGood.current = dieselNum;
  const dieselUsed = dieselBad ? lastGood.current : dieselNum;

  const result = useMemo(() => {
    try {
      const rate = hourlyRate({ hp, ageYears: age, acquisitionCostInr: cost, soil, season }, dieselUsed);
      const net = netHourlyToOwner(rate);
      return { rate, net, broker: brokerComparison(rate.total, BROKER_MARKUP), error: null };
    } catch {
      // The engine's own message names variables; people get a plain line (REVIEW T-07).
      return { error: "Something went wrong. Change an input and try again." };
    }
  }, [hp, season, soil, age, cost, dieselUsed]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <form
        className="space-y-4 rounded-card border border-border-subtle bg-surface p-[20px]"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <label className="block text-caption font-bold">
          Horsepower tier
          <select
            className={field}
            value={hp}
            onChange={(e) => {
              setHp(e.target.value as HpTier);
            }}
          >
            {HP_TIERS.map((t) => (
              <option key={t} value={t}>
                {HP_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-caption font-bold">
          Season ({SEASON_LABEL[season].toLowerCase()}: ×{SEASONAL_SURGE[season].toFixed(2)})
          <select
            className={field}
            value={season}
            onChange={(e) => {
              setSeason(e.target.value as Season);
            }}
          >
            {SEASONS.map((s) => (
              <option key={s} value={s}>
                {SEASON_LABEL[s]} (×{SEASONAL_SURGE[s].toFixed(2)})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-caption font-bold">
          Soil ({SOIL_LABEL[soil].toLowerCase()}: ×{SOIL_COEFF[soil].toFixed(2)})
          <select
            className={field}
            value={soil}
            onChange={(e) => {
              setSoil(e.target.value as Soil);
            }}
          >
            {SOILS.map((s) => (
              <option key={s} value={s}>
                {SOIL_LABEL[s]} (×{SOIL_COEFF[s].toFixed(2)})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-caption font-bold">
          Tractor age: {age} yr
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={age}
            onChange={(e) => {
              setAge(Number(e.target.value));
            }}
            className="mt-2 w-full accent-[rgb(var(--action))]"
          />
        </label>
        <label className="block text-caption font-bold">
          Acquisition cost: {formatInr2(cost)}
          <input
            type="range"
            min={300_000}
            max={2_000_000}
            step={10_000}
            value={cost}
            onChange={(e) => {
              setCost(Number(e.target.value));
            }}
            className="mt-2 w-full accent-[rgb(var(--action))]"
          />
        </label>
        <label className="block text-caption font-bold">
          Diesel price (₹/L)
          <input
            type="number"
            inputMode="decimal"
            min={1}
            max={1000}
            value={diesel}
            onChange={(e) => {
              setDiesel(e.target.value);
            }}
            aria-invalid={dieselBad || undefined}
            aria-describedby={dieselBad ? "diesel-err" : undefined}
            className={field}
          />
          {dieselBad && (
            <span id="diesel-err" className="mt-1 block text-caption font-bold text-warning">
              Enter a diesel price between ₹1 and ₹1,000 a litre.
            </span>
          )}
        </label>
      </form>

      <div className="space-y-4">
        {result.error !== null ? (
          <p role="alert" className="rounded-card border border-warning p-4 text-warning">
            {result.error}
          </p>
        ) : (
          <>
            <RateCard rate={result.rate} net={result.net} />
            <p className="text-caption text-text-muted">
              Farmers pay{" "}
              <span data-testid="broker-savings" className="font-bold text-text">
                {result.broker.farmerSavingsPct.toFixed(1)}%
              </span>{" "}
              less than through a broker, assuming the broker adds {BROKER_MARKUP * 100}% on top (pilot
              assumption, not yet surveyed).
            </p>

            <div className="rounded-card border border-border-subtle bg-surface p-[20px]">
              <h2 className="font-bold">KhetiRental rate vs informal local broker rate (₹/h)</h2>
              <div className="mt-3">
                <BarList
                  label="Hourly rate"
                  max={Math.max(result.rate.total, result.broker.brokerRate)}
                  bars={[
                    {
                      label: "KhetiRental",
                      value: result.rate.total,
                      text: formatInr2(result.rate.total),
                      tone: "success",
                    },
                    {
                      label: "Local broker",
                      value: result.broker.brokerRate,
                      text: formatInr2(Math.round(result.broker.brokerRate * 100) / 100),
                      tone: "muted",
                    },
                  ]}
                />
              </div>
            </div>

            <div
              data-testid="payback"
              className="rounded-card border border-border-subtle bg-surface p-[20px]"
            >
              <h2 className="font-bold">Owner capital payback</h2>
              <p className="mt-2 text-h2 font-bold">
                {paybackYears(cost, result.net, 250).toFixed(2)} yr{" "}
                <span className="text-text-muted">at 250 h/yr</span>
                {" → "}
                {paybackYears(cost, result.net, 620).toFixed(2)} yr{" "}
                <span className="text-text-muted">at 620 h/yr</span>
              </p>
              <p className="mt-1 text-caption text-text-muted">
                Before operator wages, maintenance and insurance, so real payback is longer.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const PARTS = [
  { key: "base", label: "Market rate", hint: "B × μ season × δ soil", color: "rgb(var(--success))" },
  { key: "fuel", label: "Diesel pass-through", hint: "F × P diesel, no margin", color: "rgb(var(--info))" },
  { key: "wear", label: "Wear recovery", hint: "D wear × κ age", color: "rgb(var(--warning))" },
] as const;

// The rate as a bill: one stacked bar of its three components, each segment
// direct-labelled so identity never rests on colour alone.
function RateCard({ rate, net }: { rate: PriceBreakdown; net: number }) {
  return (
    <div className="rounded-card border-2 border-action bg-surface p-6">
      <p className="text-caption text-text-muted">Hourly rate</p>
      <p data-testid="hourly-rate" className="mt-1 text-display font-bold tabular-nums tracking-tight">
        {formatInr2(rate.total)}
      </p>
      <div
        className="mt-[20px] flex h-4 gap-[2px] overflow-hidden rounded-control"
        role="img"
        aria-label={PARTS.map((p) => `${p.label} ${formatInr2(rate[p.key])}`).join(", ")}
      >
        {PARTS.map((p) => (
          <div
            key={p.key}
            title={`${p.label}: ${formatInr2(rate[p.key])}`}
            style={{ flexGrow: rate[p.key], background: p.color }}
          />
        ))}
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        {PARTS.map((p) => (
          <div key={p.key} className="relative pl-[18px]">
            <span
              aria-hidden
              className="absolute left-0 top-[8px] h-[10px] w-[10px] rounded-pill"
              style={{ background: p.color }}
            />
            <dt className="text-caption text-text-muted">{p.label}</dt>
            <dd className="font-bold tabular-nums">{formatInr2(rate[p.key])}</dd>
            <dd className="text-caption text-text-muted">{p.hint}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 border-t border-border-subtle pt-3 text-caption">
        Owner keeps <span className="font-bold tabular-nums">{formatInr2(net)}</span> per hour after diesel
        and the 13.5% platform fee.
      </p>
    </div>
  );
}
