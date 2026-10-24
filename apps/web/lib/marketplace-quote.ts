import { createEscrow, DEPOSIT_RATE } from "./escrow-machine";
import type { FleetMachine } from "./marketplace-fleet";
import { DEFAULT_TAKE_RATE, hourlyRate, type Season } from "./pricing-engine";

export const ACTIVITIES = ["Plowing", "Sowing", "Harvesting"] as const;
export type Activity = (typeof ACTIVITIES)[number];
export const ACTIVITY_SEASON: Record<Activity, Season> = {
  Plowing: "off_season",
  Sowing: "sowing",
  Harvesting: "harvest_compressed",
};

// Assumptions, shown to the farmer as such.
export const DIESEL_PRICE_INR = 91;
export const HOURS_PER_ACRE = 0.75;
export const MAX_HOURS = 720;
export const DEPOSIT_FLOOR_RATE = 0.005; // contract §5: 0.5 % of asset value

export const depositFloorInr = (m: FleetMachine) => m.acquisitionCostInr * DEPOSIT_FLOOR_RATE;

export const estimateHours = (acres: number) =>
  Number.isFinite(acres) && acres > 0 ? Math.max(1, Math.ceil(acres * HOURS_PER_ACRE)) : 1;

export interface Quote {
  hourlyRateInr: number;
  hours: number;
  rentalPaise: number;
  depositPaise: number;
  totalPaise: number;
  depositRule: "15 % of rental" | "tier floor";
}

/** Rate from the pricing engine; rental and deposit (15 % or the HP-tier floor) from createEscrow. */
export function quoteRental(m: FleetMachine, activity: Activity, hours: number): Quote {
  const rate = hourlyRate(
    {
      hp: m.hp,
      ageYears: m.ageYears,
      acquisitionCostInr: m.acquisitionCostInr,
      soil: m.soil,
      season: ACTIVITY_SEASON[activity],
    },
    DIESEL_PRICE_INR,
  );
  const e = createEscrow({
    hourlyRateInr: rate.total,
    contractedHours: hours,
    takeRate: DEFAULT_TAKE_RATE,
    depositFloorInr: depositFloorInr(m),
  });
  return {
    hourlyRateInr: rate.total,
    hours,
    rentalPaise: e.basePaise,
    depositPaise: e.depositPaise,
    totalPaise: e.renterPaidPaise,
    depositRule: e.depositPaise > Math.round(e.basePaise * DEPOSIT_RATE) ? "tier floor" : "15 % of rental",
  };
}

export { DEPOSIT_RATE };

export function formatInr(paise: number): string {
  const rupees = Number.isFinite(paise) ? paise / 100 : 0;
  return `₹${rupees.toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(rupees) ? 0 : 2, maximumFractionDigits: 2 })}`;
}
