// @vitest-environment node
// The renter's job and distance on a booking (UI-SPEC §4.13). The server resolves the place itself and keeps only a
// distance rounded to 0.5 km (S-07); nothing the client says about distance is believed. Adversarial: forged
// jobs, injected distances, bad coordinates, replays with different places.
import { POST as createRoute } from "@/app/api/bookings/route";
import { GET as byCode } from "@/app/api/bookings/by-code/[code]/route";
import { getSql } from "./db";
import { roundKm } from "./pricing";
import { inDays, json, makeMachine, makeUser, req, type TestUser } from "./test/fixtures";
import { createTestDb, type TestDb } from "./test/pg";

let t: TestDb;
let owner: TestUser;
let renter: TestUser;
let machine: string;
beforeAll(async () => {
  t = await createTestDb();
  process.env.DEMO_PAYMENT_DELAY_MS = "0";
  owner = await makeUser(["owner"]);
  renter = await makeUser();
  machine = await makeMachine(owner.id, { lat: 18.4088, lng: 76.5604 });
  // A PIN 5 km north-east of the machine.
  await getSql()`INSERT INTO pin_codes (pin, office, village, district, state, location, is_sample)
    VALUES ('413999', 'Test Office', 'Testpur', 'Latur', 'Maharashtra',
      ST_SetSRID(ST_MakePoint(76.6, 18.44), 4326)::geography, true)`;
});
afterAll(() => t.drop());

const none = { params: Promise.resolve({}) };
let day = 1;
const book = (body: Record<string, unknown>, u: TestUser = renter, key = crypto.randomUUID()) =>
  createRoute(
    req(
      "/api/bookings",
      json(
        { machineId: machine, startDate: inDays(day), endDate: inDays(day++), slot: "full", qty: 2, ...body },
        { cookie: u.cookie, headers: { "idempotency-key": key } },
      ),
    ),
    none,
  );
type B = { code?: string; job?: string | null; distanceKm?: number | null };
const ok = async (body: Record<string, unknown>) => {
  const res = await book(body, await makeUser());
  expect(res.status, JSON.stringify(await res.clone().json())).toBe(201);
  return (await res.json()) as B;
};
const truth = async (lat: number, lng: number) =>
  (
    await getSql()<{ km: number }[]>`
    SELECT ST_Distance(location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) / 1000 AS km
    FROM machines WHERE id = ${machine}`
  )[0].km;

describe("what is stored", () => {
  it("keeps nothing when the renter sent nothing (older links)", async () => {
    const b = await ok({});
    expect(b.job).toBeNull();
    expect(b.distanceKm).toBeNull();
  });

  it("stores the job and a server-computed distance rounded to 0.5 km, from a GPS point", async () => {
    const lat = 18.4538;
    const lng = 76.5604;
    const b = await ok({ job: "rotavate", origin: { lat, lng } });
    expect(b.job).toBe("rotavate");
    expect(b.distanceKm).toBe(roundKm(await truth(lat, lng)));
    expect(b.distanceKm! * 2).toBe(Math.round(b.distanceKm! * 2));
    expect(JSON.stringify(b)).not.toContain(String(lat));
    const row = (
      await getSql()`SELECT * FROM bookings WHERE code = ${b.code!} ORDER BY created_at DESC LIMIT 1`
    )[0];
    expect(JSON.stringify(row)).not.toContain(String(lat));
    expect(JSON.stringify(row)).not.toContain(String(lng));
  });

  it("resolves a PIN or a village name on the server", async () => {
    const want = roundKm(await truth(18.44, 76.6));
    expect((await ok({ origin: { pin: "413999" } })).distanceKm).toBe(want);
    expect((await ok({ origin: { village: "testpur" } })).distanceKm).toBe(want);
  });

  it("the owner and the renter both read it back, a stranger gets nothing", async () => {
    const buyer = await makeUser();
    const res = await book({ job: "sow", origin: { pin: "413999" } }, buyer);
    const { code } = (await res.json()) as B;
    for (const u of [owner, buyer]) {
      const r = await byCode(req(`/api/bookings/by-code/${code}`, { headers: { cookie: u.cookie } }), {
        params: Promise.resolve({ code: code! }),
      });
      expect(await r.json()).toMatchObject({ job: "sow", distanceKm: expect.any(Number) });
    }
    const stranger = await makeUser();
    const r = await byCode(req(`/api/bookings/by-code/${code}`, { headers: { cookie: stranger.cookie } }), {
      params: Promise.resolve({ code: code! }),
    });
    expect(r.status).toBe(404);
  });

  it("a replay with the same key returns the first answer, whatever place it names now", async () => {
    const u = await makeUser();
    const key = crypto.randomUUID();
    const body = { startDate: inDays(100), endDate: inDays(100) };
    const first = (await (
      await book({ ...body, job: "spray", origin: { pin: "413999" } }, u, key)
    ).json()) as B;
    const again = (await (
      await book({ ...body, job: "sow", origin: { lat: -33, lng: 151 } }, u, key)
    ).json()) as B;
    expect(again).toMatchObject({ code: first.code, job: "spray", distanceKm: first.distanceKm });
  });

  it("far away is a real distance, capped by the schema, never an error", async () => {
    const sydney = await ok({ origin: { lat: -33.87, lng: 151.21 } });
    expect(sydney.distanceKm).toBeGreaterThan(9000);
    expect(sydney.distanceKm).toBeLessThan(20100);
    expect((await ok({ origin: { lat: -90, lng: 180 } })).distanceKm).toBeGreaterThan(10000);
    expect((await ok({ origin: { lat: 90, lng: -180 } })).distanceKm).toBeGreaterThan(5000);
  });
});

describe("forged input", () => {
  const bad: [string, Record<string, unknown>][] = [
    ["unknown job", { job: "hack" }],
    ["job in another case", { job: "Plough" }],
    ["job list", { job: ["plough", "sow"] }],
    ["job object", { job: { $ne: "x" } }],
    ["a client-sent distance", { distanceKm: 1 }],
    ["a stored-column name", { renterDistanceKm: -5 }],
    ["a distance inside origin", { origin: { pin: "413999", distanceKm: 0 } }],
    ["negative distance", { origin: { distanceKm: -1 } }],
    ["huge distance", { origin: { distanceKm: 1e12 } }],
    ["latitude out of range", { origin: { lat: 91, lng: 0 } }],
    ["longitude out of range", { origin: { lat: 0, lng: -181 } }],
    ["latitude as text", { origin: { lat: "18.4", lng: 76.5 } }],
    ["lat without lng", { origin: { lat: 18.4 } }],
    ["pin and point together", { origin: { pin: "413999", lat: 18, lng: 76 } }],
    ["pin with SQL", { origin: { pin: "413999' OR '1'='1" } }],
    ["pin with the wrong shape", { origin: { pin: "12" } }],
    ["village too long", { origin: { village: "x".repeat(61) } }],
    ["origin as text", { origin: "413999" }],
    ["origin list", { origin: [18.4, 76.5] }],
    ["origin null", { origin: null }],
  ];
  it.each(bad)("%s is a 400 and books nothing", async (_n, body) => {
    const before = await getSql()`SELECT count(*)::int AS n FROM bookings`;
    const res = await book(body, await makeUser());
    expect(res.status).toBe(400);
    expect(await getSql()`SELECT count(*)::int AS n FROM bookings`).toEqual(before);
  });

  it("an unknown PIN or village still books, with no distance", async () => {
    for (const origin of [{ pin: "999999" }, { village: "Nowhereville" }]) {
      const b = await ok({ job: "sow", origin });
      expect(b).toMatchObject({ job: "sow", distanceKm: null });
    }
  });
});
