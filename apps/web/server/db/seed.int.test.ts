// @vitest-environment node
import { CATEGORIES, JOB_MACHINES, type Attachment, type Category, type Job } from "@/lib/domain";
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

  it("is idempotent: seeding twice leaves the same rows, all marked sample", async () => {
    await seed(t.sql);
    const count = async () =>
      (
        await t.sql<{ t: string; n: number }[]>`
          SELECT 'machines' AS t, count(*)::int AS n FROM machines UNION ALL
          SELECT 'bookings', count(*)::int FROM bookings UNION ALL
          SELECT 'users', count(*)::int FROM users UNION ALL
          SELECT 'reviews', count(*)::int FROM reviews UNION ALL
          SELECT 'notifications', count(*)::int FROM notifications UNION ALL
          SELECT 'problems', count(*)::int FROM problem_reports UNION ALL
          SELECT 'blocks', count(*)::int FROM machine_blocks UNION ALL
          SELECT 'pins', count(*)::int FROM pin_codes`
      ).map((r) => `${r.t}:${r.n}`);
    const first = await count();
    const n = await seed(t.sql);
    expect(await count()).toEqual(first);
    const [c] = await t.sql<{ machines: number; sample: number; bookings: number; sampleBookings: number }[]>`
      SELECT (SELECT count(*)::int FROM machines) AS machines,
             (SELECT count(*)::int FROM machines WHERE is_sample) AS sample,
             (SELECT count(*)::int FROM bookings) AS bookings,
             (SELECT count(*)::int FROM bookings WHERE is_sample) AS "sampleBookings"`;
    expect(c).toEqual({
      machines: n.machines,
      sample: n.machines,
      bookings: n.bookings,
      sampleBookings: n.bookings,
    });
  });

  it("has several machines of every category, spread over Maharashtra, with RC, paused and blocked variety", async () => {
    await seed(t.sql);
    const cats = await t.sql<{ category: string; n: number }[]>`
      SELECT category, count(*)::int AS n FROM machines GROUP BY category`;
    expect(cats.map((x) => x.category).sort()).toEqual([...CATEGORIES].sort());
    for (const x of cats) expect(x.n, x.category).toBeGreaterThanOrEqual(3);
    const [g] = await t.sql<
      { districts: number; rc: string[]; paused: number; blocked: number; balers: number }[]
    >`
      SELECT (SELECT count(DISTINCT p.district)::int FROM machines m JOIN pin_codes p ON p.pin = m.pin
              WHERE p.state = 'Maharashtra') AS districts,
             (SELECT array_agg(DISTINCT rc_status ORDER BY rc_status) FROM machines) AS rc,
             (SELECT count(*)::int FROM machines WHERE NOT active) AS paused,
             (SELECT count(DISTINCT machine_id)::int FROM machine_blocks) AS blocked,
             (SELECT count(*)::int FROM machines WHERE category = 'baler') AS balers`;
    expect(g.districts).toBeGreaterThanOrEqual(9);
    expect(g.rc).toEqual(["checked", "pending", "rejected"]);
    expect(g.paused).toBeGreaterThanOrEqual(2);
    expect(g.blocked).toBeGreaterThanOrEqual(5);
    expect(g.balers).toBeGreaterThanOrEqual(3);
  });

  it("has bookings in every status, live reply timers, reviews, notifications and open problem reports", async () => {
    await seed(t.sql);
    const st = await t.sql<
      { status: string; n: number }[]
    >`SELECT status, count(*)::int AS n FROM bookings GROUP BY status`;
    expect(st.map((x) => x.status).sort()).toEqual([
      "CANCELLED",
      "COMPLETED",
      "CONFIRMED",
      "DECLINED",
      "EXPIRED",
      "IN_PROGRESS",
      "REQUESTED",
    ]);
    const [x] = await t.sql<
      {
        live: number;
        lapsed: number;
        reviews: number;
        unread: number;
        open: number;
        resolved: number;
        both: number;
        admins: number;
      }[]
    >`
      SELECT (SELECT count(*)::int FROM bookings WHERE status = 'REQUESTED' AND reply_by > now()) AS live,
             (SELECT count(*)::int FROM bookings WHERE status = 'EXPIRED' AND reply_by <= now()) AS lapsed,
             (SELECT count(*)::int FROM reviews) AS reviews,
             (SELECT count(*)::int FROM notifications WHERE read_at IS NULL) AS unread,
             (SELECT count(*)::int FROM problem_reports WHERE status = 'open') AS open,
             (SELECT count(*)::int FROM problem_reports WHERE status = 'resolved') AS resolved,
             (SELECT count(*)::int FROM users WHERE roles @> '{owner,renter}' AND NOT roles @> '{admin}') AS both,
             (SELECT count(*)::int FROM users WHERE roles @> '{admin}') AS admins`;
    expect(x.live).toBeGreaterThanOrEqual(3);
    expect(x.lapsed).toBeGreaterThanOrEqual(2);
    expect(x.reviews).toBeGreaterThan(20);
    expect(x.unread).toBeGreaterThan(5);
    expect(x.open).toBeGreaterThanOrEqual(2);
    expect(x.resolved).toBeGreaterThanOrEqual(1);
    expect(x.both).toBeGreaterThanOrEqual(1);
    expect(x.admins).toBe(1);
  });

  it("gives every sample booking the job the machine can do and a distance in half-kilometres", async () => {
    await seed(t.sql);
    const rows = await t.sql<
      { job: string | null; km: string | null; category: string; attachments: string[] }[]
    >`
      SELECT b.job, b.renter_distance_km::text AS km, m.category, m.attachments
      FROM bookings b JOIN machines m ON m.id = b.machine_id WHERE b.is_sample`;
    expect(rows.length).toBeGreaterThan(50);
    for (const r of rows) {
      expect(r.job).not.toBeNull();
      const km = Number(r.km);
      expect(km).toBeGreaterThanOrEqual(0.5);
      expect(km).toBeLessThanOrEqual(25);
      expect(km * 2).toBe(Math.round(km * 2));
      const machines = JOB_MACHINES[r.job as Job];
      expect(
        machines.categories.includes(r.category as Category) ||
          (r.category === "tractor" &&
            r.attachments.some((a) => machines.attachments.includes(a as Attachment))) ||
          (r.category === "tractor" && r.job === "plough"),
        `${r.job} on ${r.category}`,
      ).toBe(true);
    }
    expect(new Set(rows.map((r) => r.job)).size).toBeGreaterThanOrEqual(4);
  });

  it("generates its dates from the day it runs, so the demo stays fresh", () => {
    const first = (day: string) => buildSeed(day).bookings.find((b) => b.status === "IN_PROGRESS")?.startDate;
    expect(first("2026-11-01")).not.toBe(first("2027-03-01"));
  });

  it("leaves real (non-sample) rows alone", async () => {
    await t.sql`INSERT INTO users (name, email) VALUES ('Real Person', 'real@example.com')`;
    await seed(t.sql);
    const [u] = await t.sql`SELECT 1 FROM users WHERE email = 'real@example.com'`;
    expect(u).toBeTruthy();
  });
});
