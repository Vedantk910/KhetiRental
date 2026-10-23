// TypeScript port of analytics/pricing.py (the source of truth; a golden test
// keeps the two in lockstep). All money is INR per hour.
//
//   R = (B_base × μ_season × δ_soil) + (D_wear × κ_age) + (F × P_diesel)

export const BASE_RATE_BY_HP = { "35": 300, "45": 420, "55": 520, "75_4wd": 780 } as const;
export const FUEL_PER_HOUR = { "35": 3.2, "45": 4.0, "55": 5.2, "75_4wd": 7.8 } as const;
export const SOIL_COEFF = { loam: 1.0, black_cotton: 1.25, sandy: 0.9 } as const;
export const SEASONAL_SURGE = { off_season: 1.0, sowing: 1.2, harvest_compressed: 1.45 } as const;
export const DEPRECIATION_HOURS = 10_000;
export const TAKE_RATE_BAND = [0.12, 0.15] as const;
export const DEFAULT_TAKE_RATE = 0.135;

export type HpTier = keyof typeof BASE_RATE_BY_HP;
export type Soil = keyof typeof SOIL_COEFF;
export type Season = keyof typeof SEASONAL_SURGE;
export const HP_TIERS = Object.keys(BASE_RATE_BY_HP) as HpTier[];
export const SOILS = Object.keys(SOIL_COEFF) as Soil[];
export const SEASONS = Object.keys(SEASONAL_SURGE) as Season[];

export interface MachineInput {
  hp: HpTier;
  ageYears: number;
  acquisitionCostInr: number;
  soil: Soil;
  season: Season;
}

export interface PriceBreakdown {
  base: number;
  wear: number;
  fuel: number;
  total: number;
}

// Same rounding as pricing.py's _round2.
const round2 = (x: number) => Math.round((x + 1e-9) * 100) / 100;

function lookup<T extends Record<string, number>>(table: T, key: string, label: string): number {
  if (!Object.prototype.hasOwnProperty.call(table, key)) {
    throw new RangeError(`unknown ${label}=${key}; valid: ${Object.keys(table).join(", ")}`);
  }
  return table[key as keyof T];
}

function requireInRange(x: number, label: string, min: number, max: number) {
  if (!Number.isFinite(x) || x < min || x > max) {
    throw new RangeError(`${label} must be a finite number in [${min}, ${max}], got ${x}`);
  }
}

export function hourlyRate(m: MachineInput, dieselPriceInr: number): PriceBreakdown {
  const b = lookup(BASE_RATE_BY_HP, m.hp, "hp");
  const delta = lookup(SOIL_COEFF, m.soil, "soil");
  const mu = lookup(SEASONAL_SURGE, m.season, "season");
  const f = lookup(FUEL_PER_HOUR, m.hp, "hp");
  requireInRange(m.ageYears, "ageYears", 0, 40);
  requireInRange(m.acquisitionCostInr, "acquisitionCostInr", 1, 1e8);
  requireInRange(dieselPriceInr, "dieselPriceInr", 1, 1000);

  const base = b * mu * delta;
  const wear = (m.acquisitionCostInr / DEPRECIATION_HOURS) * (1 + 0.05 * m.ageYears);
  const fuel = f * dieselPriceInr;
  return { base: round2(base), wear: round2(wear), fuel: round2(fuel), total: round2(base + wear + fuel) };
}

/** Owner income per billed hour: fuel is a zero-margin pass-through (ADR-0004), take-rate comes off the rest. */
export function netHourlyToOwner(p: PriceBreakdown, takeRate = DEFAULT_TAKE_RATE): number {
  if (!(takeRate >= TAKE_RATE_BAND[0] && takeRate <= TAKE_RATE_BAND[1])) {
    throw new RangeError(`take-rate ${takeRate} outside policy band ${TAKE_RATE_BAND.join("-")}`);
  }
  return round2((p.total - p.fuel) * (1 - takeRate));
}

export function paybackYears(acquisitionCostInr: number, netHourly: number, annualHours: number): number {
  const annual = netHourly * annualHours;
  return annual > 0 ? acquisitionCostInr / annual : Number.POSITIVE_INFINITY;
}

/** A broker charging `markup` over the platform rate; the farmer saves 1 - 1/(1+markup). */
export function brokerComparison(platformRate: number, markup = 0.38) {
  const brokerRate = platformRate * (1 + markup);
  return { brokerRate, farmerSavingsPct: (1 - platformRate / brokerRate) * 100 };
}
