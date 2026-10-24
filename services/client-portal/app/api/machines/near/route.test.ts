import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { GET } from "./route";

const call = (qs: string) => GET(new Request(`http://x/api/machines/near?${qs}`));
const valid = (b: unknown) => {
  const o = b as { candidates: Record<string, unknown>[]; took_ms: number };
  expect(typeof o.took_ms).toBe("number");
  expect(Array.isArray(o.candidates)).toBe(true);
  for (const c of o.candidates) {
    expect(Object.keys(c).sort()).toEqual(["dist_km", "hp", "id", "reputation", "score"]);
    expect(typeof c.id).toBe("string");
    for (const f of ["dist_km", "score", "hp", "reputation"]) expect(Number.isFinite(c[f])).toBe(true);
  }
};
const C = "lat=26.84&lng=75.83";

describe("GET /api/machines/near", () => {
  it("200 with schema and defaults", async () => {
    const r = await call(C);
    expect(r.status).toBe(200);
    const b = await r.json();
    valid(b);
    expect(b.candidates.length).toBeGreaterThan(0);
    expect(b.candidates.length).toBeLessThanOrEqual(20);
  });
  it.each(["", "lat=26.84", "lng=75.83", "lat=abc&lng=75", "lat=NaN&lng=75", "lat=91&lng=75", "lat=1&lng=181", "lat=&lng=1", "lat=0x10&lng=1", "lat=Infinity&lng=1"])(
    "400 for %j", async (qs) => {
      const r = await call(qs);
      expect(r.status).toBe(400);
      expect(typeof (await r.json()).error).toBe("string");
    });
  it("honours limit and falls back to 20 outside 1..100 (as Go does)", async () => {
    expect((await (await call(`${C}&limit=3&k=5`)).json()).candidates).toHaveLength(3);
    const huge = (await (await call(`${C}&limit=1000000000&k=5&radius_km=50`)).json()).candidates;
    expect(huge.length).toBeLessThanOrEqual(20);
  });
  it("trims by radius, sorted by score desc", async () => {
    const b = await (await call(`${C}&k=5&radius_km=0.8`)).json();
    expect(b.candidates.every((c: { dist_km: number }) => c.dist_km <= 0.8)).toBe(true);
    const wide = await (await call(`${C}&k=5&radius_km=5`)).json();
    expect(b.candidates.length).toBeLessThan(wide.candidates.length);
    const s = wide.candidates.map((c: { score: number }) => c.score);
    expect([...s].sort((a, b2) => b2 - a)).toEqual(s);
  });
  it("hp changes the ranking input", async () => {
    const a = await (await call(`${C}&hp=35`)).json();
    const b = await (await call(`${C}&hp=75`)).json();
    expect(a.candidates[0].score).not.toBe(b.candidates[0].score);
  });
  it("is empty (not an error) far from the fleet", async () => {
    const b = await (await call("lat=10&lng=77")).json();
    expect(b.candidates).toEqual([]);
  });
  it("property: any query string yields 200 or 400, never throws", async () => {
    await fc.assert(fc.asyncProperty(fc.string(), fc.string(), fc.string(), fc.string(), fc.string(), async (a, b, c, d, e) => {
      const qs = new URLSearchParams({ lat: a, lng: b, k: c, radius_km: d, limit: e }).toString();
      const r = await call(qs);
      return r.status === 200 || r.status === 400;
    }), { numRuns: 300 });
  });
});
