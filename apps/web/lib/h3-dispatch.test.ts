import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_WEIGHTS,
  DEMO_CENTER,
  DEMO_FLEET,
  EDGE_KM,
  findNear,
  gridRing,
  haversineKm,
  radiusToK,
  rank,
  redisPipeline,
  redisKey,
  type Res,
} from "./h3-dispatch";

const RING = (k: number) => 3 * k * (k + 1) + 1;

describe("resolution tiers", () => {
  it("matches the Go edge lengths", () => {
    expect(EDGE_KM).toEqual({ 7: 1.2, 8: 0.46, 9: 0.174 });
  });
});

describe("gridRing", () => {
  it.each([
    [1, 7],
    [2, 19],
    [3, 37],
    [4, 61],
    [5, 91],
  ])("k=%i gives %i cells", (k, n) => {
    const { origin, ring } = gridRing(26.84, 75.83, 8, k);
    expect(ring).toHaveLength(n);
    expect(ring).toContain(origin);
    expect(new Set(ring).size).toBe(n);
  });
  it.each([0, 6, -1, 1.5, NaN])("rejects k=%s", (k) => {
    expect(() => gridRing(26.84, 75.83, 8, k)).toThrow(/out of supported range/);
  });
  it("property: ring size 3k(k+1)+1 and contains origin anywhere in India", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 6.5, max: 37.1, noNaN: true }),
        fc.double({ min: 68, max: 97.5, noNaN: true }),
        fc.integer({ min: 1, max: 5 }),
        fc.constantFrom<Res>(7, 8, 9),
        (lat, lng, k, res) => {
          const { origin, ring } = gridRing(lat, lng, res, k);
          return ring.length === RING(k) && ring.includes(origin);
        },
      ),
    );
  });
});

describe("radiusToK (store.go handleNear)", () => {
  it("converts and clamps to [1,5]", () => {
    expect(radiusToK(0.1, 8, 5)).toBe(1);
    expect(radiusToK(1, 8, 5)).toBe(3); // int(1/0.46)+1
    expect(radiusToK(5, 8, 5)).toBe(5); // 11 clamped
    expect(radiusToK(5, 7, 5)).toBe(5); // int(5/1.2)+1
    expect(radiusToK(5, 9, 2)).toBe(2); // min(k, byRadius)
  });
});

describe("redis pipeline", () => {
  it("uses the decimal uint64 key the Go store writes", () => {
    const { origin } = gridRing(26.84, 75.83, 8, 1);
    expect(redisKey(origin)).toBe(`machines:h3:${BigInt("0x" + origin).toString()}`);
  });
  it("lists one HGETALL per ring cell", () => {
    const { ring } = gridRing(26.84, 75.83, 8, 3);
    const p = redisPipeline(ring);
    expect(p).toHaveLength(37);
    expect(p[0]).toMatch(/^HGETALL machines:h3:\d+$/);
  });
});

describe("haversine", () => {
  it("is zero for identical points and ~111.19 km per degree of latitude", () => {
    expect(haversineKm({ lat: 1, lng: 2 }, { lat: 1, lng: 2 })).toBe(0);
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.19, 1);
  });
});

describe("rank (ranker_test.go parity)", () => {
  const req = { lat: 26.84, lng: 75.83 };
  const c = (id: string, dLat: number, dLng: number, hp: number, rep: number) => ({
    id,
    lat: req.lat + dLat,
    lng: req.lng + dLng,
    hp,
    reputation: rep,
  });
  it("weights sum to 1", () => {
    expect(DEFAULT_WEIGHTS.distance + DEFAULT_WEIGHTS.hp + DEFAULT_WEIGHTS.reputation).toBeCloseTo(1, 12);
  });
  it("prefers closer and higher reputation", () => {
    const out = rank(
      [c("far-low", 0.1, 0, 55, 0.2), c("near-high", 0.005, 0, 45, 0.9), c("mid-mid", 0.05, 0, 45, 0.5)],
      45,
      req,
    );
    expect(out.map((o) => o.id)).toEqual(["near-high", "mid-mid", "far-low"]);
  });
  it("closer machine wins when hp and reputation tie", () => {
    const out = rank([c("b", 0, 0.01, 45, 0.5), c("a", 0, 0.001, 45, 0.5)], 45, req, {
      distance: 0.6,
      hp: 0.3,
      reputation: 0.1,
    });
    expect(out[0].id).toBe("a");
  });
  it("rejects weights that do not sum to 1", () => {
    expect(() => rank([], 45, req, { distance: 0.9, hp: 0.5, reputation: 0.1 })).toThrow(/sum to 1/);
  });
  it("scores exactly: zero distance, matching hp, rep 1", () => {
    const [s] = rank([c("x", 0, 0, 45, 1)], 45, req);
    expect(s.score).toBeCloseTo(0.5 + 0.3 * 0.5 + 0.2, 12);
    expect(s.distKm).toBe(0);
  });
});

describe("findNear", () => {
  const base = { ...DEMO_CENTER, radiusKm: 5, hp: 45, k: 2, limit: 20, res: 8 as Res };
  it("never exceeds limit and everything is within radius and sorted", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 26.6, max: 27.1, noNaN: true }),
        fc.double({ min: 75.5, max: 76.1, noNaN: true }),
        fc.double({ min: 0.05, max: 20, noNaN: true }),
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 1, max: 100 }),
        (lat, lng, radiusKm, k, limit) => {
          const r = findNear(DEMO_FLEET, { ...base, lat, lng, radiusKm, k, limit });
          return (
            r.candidates.length <= limit &&
            r.candidates.every((x) => x.distKm <= radiusKm) &&
            r.candidates.every((x, i, a) => i === 0 || a[i - 1].score >= x.score) &&
            r.ring.length === RING(r.usedK)
          );
        },
      ),
    );
  });
  it("tight radius trims ring corners", () => {
    const wide = findNear(DEMO_FLEET, { ...base, k: 5, radiusKm: 5 });
    const tight = findNear(DEMO_FLEET, { ...base, k: 5, radiusKm: 0.5 });
    expect(tight.candidates.length).toBeLessThan(wide.candidates.length);
    expect(tight.candidates.every((c) => c.distKm <= 0.5)).toBe(true);
  });
  it("only returns machines inside the ring", () => {
    const r = findNear(DEMO_FLEET, { ...base, k: 1, radiusKm: 50 });
    const cells = new Set(r.ring);
    expect(r.candidates.every((c) => cells.has(c.cell))).toBe(true);
  });
});

describe("demo fleet", () => {
  it("is deterministic, ~60 machines, unique ids, HP tiers 35/45/55/75", () => {
    expect(DEMO_FLEET.length).toBe(60);
    expect(new Set(DEMO_FLEET.map((m) => m.id)).size).toBe(60);
    expect(new Set(DEMO_FLEET.map((m) => m.hp))).toEqual(new Set([35, 45, 55, 75]));
    expect(DEMO_FLEET.every((m) => m.reputation >= 0 && m.reputation <= 1)).toBe(true);
  });
});
