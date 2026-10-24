// @vitest-environment node
import { buildSeed } from "./seed-data";
import { seed } from "./seed";
import { createTestDb, type TestDb } from "../test/pg";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(() => t.drop());

describe("sample seed", () => {
  it("is deterministic", () => {
    expect(buildSeed("2026-11-01")).toEqual(buildSeed("2026-11-01"));
  });

  it("loads 3 districts, 40 machines, 6 owners, 4 renters, all marked sample; reseeding replaces it", async () => {
    const n = await seed(t.sql);
    expect(n.machines).toBe(40);
    await seed(t.sql);
    const [c] = await t.sql<
      {
        machines: number;
        sample: number;
        owners: number;
        renters: number;
        districts: number;
        reviews: number;
        upcoming: number;
      }[]
    >`
      SELECT (SELECT count(*)::int FROM machines) AS machines,
             (SELECT count(*)::int FROM machines WHERE is_sample) AS sample,
             (SELECT count(*)::int FROM users WHERE roles @> '{owner}' AND NOT roles @> '{admin}') AS owners,
             (SELECT count(*)::int FROM users WHERE roles = '{renter}' AND email LIKE '%@khetirental.test' AND name <> 'Demo Google User') AS renters,
             (SELECT count(DISTINCT district)::int FROM pin_codes) AS districts,
             (SELECT count(*)::int FROM reviews) AS reviews,
             (SELECT count(*)::int FROM bookings WHERE status IN ('REQUESTED','CONFIRMED')) AS upcoming`;
    expect(c).toMatchObject({ machines: 40, sample: 40, owners: 6, renters: 4, districts: 3, upcoming: 10 });
    expect(c.reviews).toBeGreaterThan(20);
    const cats = await t.sql<{ category: string }[]>`SELECT DISTINCT category FROM machines`;
    expect(cats.length).toBe(7);
  });

  it("leaves real (non-sample) rows alone", async () => {
    await t.sql`INSERT INTO users (name, email) VALUES ('Real Person', 'real@example.com')`;
    await seed(t.sql);
    const [u] = await t.sql`SELECT 1 FROM users WHERE email = 'real@example.com'`;
    expect(u).toBeTruthy();
  });
});
