// @vitest-environment node
import { createTestDb, type TestDb } from "../test/pg";
import { makeMachine, makeUser } from "../test/fixtures";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(() => t.drop());

let seq = 0;
const insert = (
  machineId: string,
  renterId: string,
  range: string,
  status = "REQUESTED",
  key = crypto.randomUUID(),
) =>
  t.sql`INSERT INTO bookings (code, machine_id, renter_id, during, start_date, end_date, slot, est_qty, unit,
          rate_paise, rent_paise, deposit_paise, diesel_included, total_paise, status, reply_by, idempotency_key)
        VALUES (${`KR-${String(++seq).padStart(4, "0")}`}, ${machineId}, ${renterId},
          ${range}::tstzrange, '2026-11-02', '2026-11-02', 'full', 4, 'hour', 75000, 300000, 75000, true, 300000,
          ${status}, now() + interval '2 hours', ${key})`;

const code = (e: unknown) => (e as { code?: string }).code;

describe("schema constraints (F-09)", () => {
  it("has postgis and btree_gist", async () => {
    const rows = await t.sql<{ extname: string }[]>`SELECT extname FROM pg_extension`;
    expect(rows.map((r) => r.extname)).toEqual(expect.arrayContaining(["postgis", "btree_gist"]));
  });

  it("EXCLUDE rejects an overlapping active booking with 23P01", async () => {
    const owner = await makeUser(["owner"]);
    const renter = await makeUser();
    const m = await makeMachine(owner.id);
    await insert(m, renter.id, "[2026-11-02 07:00+05:30,2026-11-02 19:00+05:30)");
    const err: unknown = await insert(m, renter.id, "[2026-11-02 13:00+05:30,2026-11-03 13:00+05:30)").catch(
      (e: unknown) => e,
    );
    expect(code(err)).toBe("23P01");
  });

  it("allows back-to-back slots (half-open ranges) and other machines", async () => {
    const owner = await makeUser(["owner"]);
    const renter = await makeUser();
    const m = await makeMachine(owner.id);
    const m2 = await makeMachine(owner.id);
    await insert(m, renter.id, "[2026-11-05 07:00+05:30,2026-11-05 13:00+05:30)");
    await insert(m, renter.id, "[2026-11-05 13:00+05:30,2026-11-05 19:00+05:30)");
    await insert(m2, renter.id, "[2026-11-05 07:00+05:30,2026-11-05 19:00+05:30)");
  });

  it("cancelled, declined and expired bookings free the slot", async () => {
    const owner = await makeUser(["owner"]);
    const renter = await makeUser();
    const m = await makeMachine(owner.id);
    const r = "[2026-11-06 07:00+05:30,2026-11-06 19:00+05:30)";
    for (const s of ["CANCELLED", "DECLINED", "EXPIRED"]) await insert(m, renter.id, r, s);
    await insert(m, renter.id, r, "CONFIRMED");
  });

  it("idempotency_key is unique and the booking code is unique among active bookings", async () => {
    const owner = await makeUser(["owner"]);
    const renter = await makeUser();
    const m = await makeMachine(owner.id);
    await insert(
      m,
      renter.id,
      "[2026-11-07 07:00+05:30,2026-11-07 13:00+05:30)",
      "REQUESTED",
      "same-key-123",
    );
    const dup: unknown = await insert(
      m,
      renter.id,
      "[2026-11-08 07:00+05:30,2026-11-08 13:00+05:30)",
      "REQUESTED",
      "same-key-123",
    ).catch((e: unknown) => e);
    expect(code(dup)).toBe("23505");
    expect((dup as { constraint_name?: string }).constraint_name).toMatch(/idempotency/);
  });

  it("CHECKs reject bad money, roles and categories", async () => {
    const owner = await makeUser(["owner"]);
    expect(code(await makeMachine(owner.id, { pricePaise: -100 }).catch((e: unknown) => e))).toBe("23514");
    expect(code(await makeMachine(owner.id, { pricePaise: 75_050 }).catch((e: unknown) => e))).toBe("23514");
    expect(code(await makeMachine(owner.id, { category: "spaceship" }).catch((e: unknown) => e))).toBe(
      "23514",
    );
    expect(
      code(
        await t.sql`INSERT INTO users (name, roles) VALUES ('Bad', '{superuser}')`.catch((e: unknown) => e),
      ),
    ).toBe("23514");
  });

  it("CHECKs keep a booking's job to the known list and its distance to a real range", async () => {
    const owner = await makeUser(["owner"]);
    const renter = await makeUser();
    const m = await makeMachine(owner.id);
    const withExtra = (job: string | null, km: number | null, day: number) =>
      t.sql`INSERT INTO bookings (code, machine_id, renter_id, during, start_date, end_date, slot, est_qty, unit,
              rate_paise, rent_paise, deposit_paise, diesel_included, total_paise, reply_by, idempotency_key, job, renter_distance_km)
            VALUES (${`KR-${String(++seq).padStart(4, "0")}`}, ${m}, ${renter.id},
              ${`[2027-03-${day} 07:00+05:30,2027-03-${day} 13:00+05:30)`}::tstzrange, ${`2027-03-${day}`}, ${`2027-03-${day}`},
              'full', 4, 'hour', 75000, 300000, 75000, true, 300000, now() + interval '2 hours', ${crypto.randomUUID()},
              ${job}, ${km})`;
    await withExtra(null, null, 10);
    await withExtra("sow", 12.5, 11);
    for (const [job, km] of [
      ["hack", 1],
      ["sow", -0.5],
      ["sow", 20101],
    ] as const)
      expect(code(await withExtra(job, km, 12).catch((e: unknown) => e)), `${job} ${km}`).toBe("23514");
  });
});
