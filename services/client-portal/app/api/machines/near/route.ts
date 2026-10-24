import { DEMO_FLEET, findNear, type Res } from "@/lib/h3-dispatch";

// Implements GET /machines/near from contracts/openapi.yaml over the synthetic DEMO_FLEET (no Redis here).
const RES: Res = 8;
const FLOAT = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const INT = /^[+-]?\d+$/;

const float = (s: string | null) => (s !== null && FLOAT.test(s) && Number.isFinite(Number(s)) ? Number(s) : null);
const int = (s: string | null) => (s !== null && INT.test(s) ? Number(s) : null);
const bad = (error: string) => Response.json({ error }, { status: 400 });

export function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const lat = float(q.get("lat"));
  if (lat === null || lat < -90 || lat > 90) return bad("lat is required and must be a number in [-90, 90]");
  const lng = float(q.get("lng"));
  if (lng === null || lng < -180 || lng > 180) return bad("lng is required and must be a number in [-180, 180]");

  // Optional params fall back to defaults when invalid, exactly like handleNear.
  const r = float(q.get("radius_km"));
  const radiusKm = r !== null && r > 0 ? r : 5;
  const hp = float(q.get("hp")) ?? 45;
  const l = int(q.get("limit"));
  const limit = l !== null && l >= 1 && l <= 100 ? l : 20;
  const kk = int(q.get("k"));
  const k = kk !== null && kk >= 1 && kk <= 5 ? kk : 2;

  const start = performance.now();
  const { candidates } = findNear(DEMO_FLEET, { lat, lng, radiusKm, hp, k, limit, res: RES });
  return Response.json({
    candidates: candidates.map((c) => ({ id: c.id, dist_km: c.distKm, score: c.score, hp: c.hp, reputation: c.reputation })),
    took_ms: performance.now() - start,
  });
}
