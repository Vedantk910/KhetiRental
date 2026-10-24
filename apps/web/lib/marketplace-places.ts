export interface Place {
  name: string;
  lat: number;
  lng: number;
}

// Villages around the demo fleet in Jaipur district (lib/h3-dispatch DEMO_CENTER).
export const VILLAGES: Place[] = [
  { name: "Sanganer", lat: 26.8187, lng: 75.7908 },
  { name: "Jagatpura", lat: 26.8237, lng: 75.8674 },
  { name: "Muhana", lat: 26.7902, lng: 75.7611 },
  { name: "Goner", lat: 26.7836, lng: 75.9258 },
  { name: "Pratap Nagar", lat: 26.8013, lng: 75.8166 },
  { name: "Sitapura", lat: 26.7817, lng: 75.8434 },
];

const sq = (x: number) => x * x;
/** Closest listed village to a point (planar approximation is fine at district scale). */
export const nearestVillage = (p: Pick<Place, "lat" | "lng">): Place =>
  VILLAGES.reduce((best, v) =>
    sq(v.lat - p.lat) + sq(v.lng - p.lng) < sq(best.lat - p.lat) + sq(best.lng - p.lng) ? v : best,
  );

export interface NearCandidate {
  id: string;
  dist_km: number;
  score: number;
  hp?: number;
  reputation?: number;
}

/** Reads /api/machines/near defensively: anything unexpected becomes an empty list rather than a crash. */
export function parseNear(data: unknown): NearCandidate[] {
  const list = (data as { candidates?: unknown } | null)?.candidates;
  if (!Array.isArray(list)) return [];
  return list.filter((c: unknown): c is NearCandidate => {
    const o = c as Partial<NearCandidate> | null;
    return !!o && typeof o.id === "string" && Number.isFinite(o.dist_km);
  });
}

// At H3 Res 8 the matching engine reads at most a k=5 ring (~4 km), so asking
// for a wider radius returns nothing more (showcase/docs/adr/0001-h3-vs-postgis.md).
export const SEARCH_RADIUS_KM = 4;

export const nearUrl = (p: Pick<Place, "lat" | "lng">, radiusKm = SEARCH_RADIUS_KM, limit = 12) =>
  `/api/machines/near?lat=${p.lat}&lng=${p.lng}&radius_km=${radiusKm}&k=5&limit=${limit}`;
