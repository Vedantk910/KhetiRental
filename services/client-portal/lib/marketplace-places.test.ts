import { describe, expect, it } from "vitest";
import { nearUrl, parseNear } from "./marketplace-places";

describe("parseNear", () => {
  it("keeps well-formed candidates and drops junk", () => {
    expect(parseNear({ candidates: [{ id: "a", dist_km: 1, score: 1 }, { id: 3 }, null, { id: "b", dist_km: "x" }] })).toHaveLength(1);
  });
  it("tolerates anything else", () => {
    for (const v of [null, undefined, 5, {}, { candidates: "x" }]) expect(parseNear(v)).toEqual([]);
  });
});
it("builds the query", () => expect(nearUrl({ lat: 1, lng: 2 })).toBe("/api/machines/near?lat=1&lng=2&radius_km=4&k=5&limit=12"));
