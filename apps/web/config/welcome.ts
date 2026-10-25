// Welcome-page knobs (UI-SPEC §4.1.2–§4.1.3). Change a value here; nothing else needs touching.
export type TimeOfDay = "morning" | "noon" | "evening";

/** One full round of the tractor (right along row 1, back along row 2), in seconds. Range 10–60. */
export const LAP_SECONDS = 24;
export const TIME_OF_DAY: TimeOfDay = "morning";
export const SHOW_TRACTOR = true;

/** Sun centre y in the 390 × 844 drawing, and the colours of sky, sun and the two hills. */
export const SKY: Record<
  TimeOfDay,
  { sky: string; sun: string; sunY: number; hill1: string; hill2: string }
> = {
  morning: { sky: "#CFE3F2", sun: "#FBC02D", sunY: 318, hill1: "#7FA35A", hill2: "#5E8A3E" },
  noon: { sky: "#9CC7EA", sun: "#FFD45C", sunY: 300, hill1: "#6E9A48", hill2: "#4E7A2E" },
  evening: { sky: "#F2B78A", sun: "#E0703A", sunY: 326, hill1: "#6B7A45", hill2: "#4A5A30" },
};

export const COUNTER_MS = 1800;
/** Share of the counter row that must be on screen before counting starts. */
export const COUNTER_VISIBLE = 0.35;

export const STATS = [
  { key: "small", sr: "sr1", value: 86, decimals: 0, suffix: "%" },
  { key: "avg", sr: "sr2", value: 1.08, decimals: 2, suffix: "" },
  { key: "mech", sr: "sr3", value: 47, decimals: 0, suffix: "%" },
] as const;

/**
 * The tractor and the implements that attach to it, with typical 2025–26 Maharashtra market prices (approximate).
 * Tractor: 45–50 HP. Prices are whole rupees; rent is per hour, except the trolley, per day.
 * The "key" is both the machines.* message and the node name in public/models/tractor.glb.
 */
export const COMPONENTS = [
  { key: "tractor", buy: 640_000, rent: 700, per: "hour" },
  { key: "rotavator", buy: 110_000, rent: 400, per: "hour" },
  { key: "plough", buy: 35_000, rent: 250, per: "hour" },
  { key: "seedDrill", buy: 60_000, rent: 300, per: "hour" },
  { key: "trolley", buy: 150_000, rent: 500, per: "day" },
] as const;
export type ComponentKey = (typeof COMPONENTS)[number]["key"];
