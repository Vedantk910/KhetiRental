// TS port of services/matching-engine (h3geo/spatial.go, ranker/ranker.go, store/store.go handleNear).
import { cellToLatLng, gridDisk, latLngToCell } from "h3-js";

export type Res = 7 | 8 | 9;
export const EDGE_KM: Record<Res, number> = { 7: 1.2, 8: 0.46, 9: 0.174 };
export const DEFAULT_WEIGHTS = { distance: 0.5, hp: 0.3, reputation: 0.2 };
export type Weights = typeof DEFAULT_WEIGHTS;
const TAU_KM = 2.0;

export interface LatLng { lat: number; lng: number }
export interface Machine extends LatLng { id: string; hp: number; reputation: number }
export interface Ranked extends Machine { score: number; distKm: number }

export function haversineKm(a: LatLng, b: LatLng): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function gridRing(lat: number, lng: number, res: Res, k: number) {
  if (!Number.isInteger(k) || k < 1 || k > 5) throw new Error(`h3geo: k-ring ${k} out of supported range [1,5]`);
  const origin = latLngToCell(lat, lng, res);
  return { origin, ring: gridDisk(origin, k) };
}

/** Same arithmetic as handleNear: kByRadius = int(radius/edge)+1 clamped to [1,5], then min with k. */
export function radiusToK(radiusKm: number, res: Res, k: number): number {
  const byRadius = Math.min(5, Math.max(1, Math.trunc(radiusKm / EDGE_KM[res]) + 1));
  return Math.min(k, byRadius);
}

// Go writes the decimal uint64; h3-js cells are hex strings.
export const redisKey = (cell: string) => `machines:h3:${BigInt("0x" + cell).toString()}`;
export const redisPipeline = (ring: string[]) => ring.map((c) => `HGETALL ${redisKey(c)}`);

export function rank(cands: Machine[], reqHp: number, req: LatLng, w: Weights = DEFAULT_WEIGHTS): Ranked[] {
  if (Math.abs(w.distance + w.hp + w.reputation - 1) > 1e-9) throw new Error("ranker: weights must sum to 1.0");
  const out = cands.map((c) => {
    const distKm = haversineKm(req, c);
    const hpScore = 1 / (1 + Math.exp(Math.abs(reqHp - c.hp) / 3));
    const score = w.distance * Math.exp(-distKm / TAU_KM) + w.hp * hpScore + w.reputation * c.reputation;
    return { ...c, score, distKm };
  });
  // Array.prototype.sort is stable, like sort.SliceStable.
  return out.sort((a, b) => (Math.abs(a.score - b.score) > 1e-12 ? b.score - a.score : a.distKm - b.distKm));
}

export interface NearParams extends LatLng { radiusKm: number; hp: number; k: number; limit: number; res: Res }

export function findNear(fleet: Machine[], p: NearParams) {
  const usedK = radiusToK(p.radiusKm, p.res, p.k);
  const { origin, ring } = gridRing(p.lat, p.lng, p.res, usedK);
  const inRing = new Set(ring);
  const cellOf = new Map<string, string>();
  const within = fleet.filter((m) => {
    const cell = latLngToCell(m.lat, m.lng, p.res);
    cellOf.set(m.id, cell);
    return inRing.has(cell) && haversineKm(p, m) <= p.radiusKm; // ring is a hexagonal superset: trim corners
  });
  const candidates = rank(within, p.hp, p).slice(0, p.limit).map((c) => ({ ...c, cell: cellOf.get(c.id)! }));
  return { origin, ring, usedK, pipeline: redisPipeline(ring), candidates };
}

// ---- DEMO DATA: synthetic, seeded fleet. Not real machines or owners. ----
export const DEMO_CENTER: LatLng = { lat: 26.84, lng: 75.83 };

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildFleet(): Machine[] {
  const rnd = mulberry32(2026);
  const hps = [35, 45, 55, 75];
  return Array.from({ length: 60 }, (_, i) => {
    // First 15 sit in a ~3.5 km village cluster (the sandbox fleet); the rest spread across ~12 km.
    const radiusKm = (i < 15 ? 3.5 : 12) * Math.sqrt(rnd());
    const theta = rnd() * 2 * Math.PI;
    return {
      id: `M-${String(i + 1).padStart(3, "0")}`,
      lat: DEMO_CENTER.lat + (radiusKm * Math.sin(theta)) / 110.57,
      lng: DEMO_CENTER.lng + (radiusKm * Math.cos(theta)) / (111.32 * Math.cos((DEMO_CENTER.lat * Math.PI) / 180)),
      hp: hps[i % 4],
      reputation: Math.round((0.35 + 0.65 * rnd()) * 100) / 100,
    };
  });
}
export const DEMO_FLEET: Machine[] = buildFleet();
export const cellCentre = (cell: string): LatLng => { const [lat, lng] = cellToLatLng(cell); return { lat, lng }; };
