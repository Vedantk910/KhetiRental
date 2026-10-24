// @vitest-environment node
import { GET as searchRoute } from "@/app/api/machines/route";
import { GET as detailRoute } from "@/app/api/machines/[id]/route";
import { inDays, makeMachine, makeUser, req, type TestUser } from "./test/fixtures";
import { createTestDb, type TestDb } from "./test/pg";

let t: TestDb;
let viewer: TestUser;
// A clean area in Jaipur district so other test files' fixtures can't leak in (each file has its own DB anyway).
const O = { lat: 26.9, lng: 75.8 };
const KM_LAT = 1 / 111.2; // degrees per km northwards
const ids: Record<string, string> = {};

beforeAll(async () => {
  t = await createTestDb();
  viewer = await makeUser();
  const owner = await makeUser(["owner"]);
  await t.sql`UPDATE users SET name = 'Ramesh Patil' WHERE id = ${owner.id}`;
  await t.sql`INSERT INTO pin_codes (pin, office, village, district, state, location)
              VALUES ('302029', 'Sanganer S.O', 'Sanganer', 'Jaipur', 'Rajasthan',
                      ST_SetSRID(ST_MakePoint(${O.lng}, ${O.lat}), 4326)::geography)`;
  const at = (km: number) => ({ lat: O.lat + km * KM_LAT, lng: O.lng });
  ids.near = await makeMachine(owner.id, { ...at(1.2), pricePaise: 90_000, attachments: ["rotavator"] });
  ids.mid = await makeMachine(owner.id, { ...at(7.3), pricePaise: 60_000, attachments: ["plough"] });
  ids.far = await makeMachine(owner.id, { ...at(20), pricePaise: 50_000, attachments: [] });
  ids.out = await makeMachine(owner.id, { ...at(30), pricePaise: 10_000 });
  ids.harvester = await makeMachine(owner.id, {
    ...at(3),
    category: "combine_harvester",
    attachments: [],
    hp: 100,
    priceUnit: "acre",
    pricePaise: 250_000,
  });
  ids.paused = await makeMachine(owner.id, { ...at(2), active: false });
  // ratings: "mid" has 6 × 5★, "near" 1 × 5★
  const renter = await makeUser();
  const review = async (machineId: string, stars: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const [b] = await t.sql<{ id: string }[]>`
        INSERT INTO bookings (code, machine_id, renter_id, during, start_date, end_date, slot, est_qty, unit, rate_paise,
          rent_paise, deposit_paise, diesel_included, total_paise, status, reply_by, idempotency_key)
        VALUES ('KR-0001', ${machineId}, ${renter.id}, tstzrange(now() - make_interval(days => ${i + 10}), now() - make_interval(days => ${i + 10}) + interval '1 hour'),
          '2026-01-01', '2026-01-01', 'full', 1, 'hour', 100, 100, 0, true, 100, 'COMPLETED', now(), ${crypto.randomUUID()})
        RETURNING id`;
      await t.sql`INSERT INTO reviews (booking_id, author_id, target_user_id, stars) VALUES (${b.id}, ${renter.id}, ${owner.id}, ${stars})`;
    }
  };
  await review(ids.mid, 5, 6);
  await review(ids.near, 5, 1);
  // "near" is busy on day +10 (full day) and blocked on day +11
  await t.sql`INSERT INTO bookings (code, machine_id, renter_id, during, start_date, end_date, slot, est_qty, unit, rate_paise,
      rent_paise, deposit_paise, diesel_included, total_paise, status, reply_by, idempotency_key)
    VALUES ('KR-0002', ${ids.near}, ${renter.id},
      tstzrange((${inDays(10)}::date + time '07:00') AT TIME ZONE 'Asia/Kolkata', (${inDays(10)}::date + time '19:00') AT TIME ZONE 'Asia/Kolkata'),
      ${inDays(10)}, ${inDays(10)}, 'full', 4, 'hour', 90000, 360000, 90000, true, 360000, 'CONFIRMED', now() + interval '1 hour', ${crypto.randomUUID()})`;
  await t.sql`INSERT INTO machine_blocks (machine_id, day) VALUES (${ids.near}, ${inDays(11)})`;
});
afterAll(() => t.drop());

const search = async (q: Record<string, string>, user: TestUser | null = viewer) => {
  const r = await searchRoute(
    req(`/api/machines?${new URLSearchParams(q).toString()}`, {
      headers: user ? { cookie: user.cookie } : {},
    }),
    { params: Promise.resolve({} as Record<string, never>) },
  );
  return { status: r.status, body: await r.json() };
};
const order = (body: { items: { id: string }[] }) =>
  body.items.map((i) => Object.entries(ids).find(([, v]) => v === i.id)?.[0]);

describe("GET /api/machines (search)", () => {
  it("needs a session", async () => {
    expect((await search({ pin: "302029" }, null)).status).toBe(401);
  });

  it("finds by PIN, defaults to 10 km, nearest first, inactive hidden", async () => {
    const { status, body } = await search({ pin: "302029" });
    expect(status).toBe(200);
    expect(order(body)).toEqual(["near", "harvester", "mid"]);
    expect(body.place).toEqual({ label: "Sanganer", district: "Jaipur" });
    expect(body.applied).toMatchObject({ radiusKm: 10, sort: "nearest" });
  });

  it("radius 5 / 25 km and village or lat/lng search", async () => {
    expect(order((await search({ village: "sanganer", radius: "5" })).body)).toEqual(["near", "harvester"]);
    expect(order((await search({ lat: String(O.lat), lng: String(O.lng), radius: "25" })).body)).toEqual([
      "near",
      "harvester",
      "mid",
      "far",
    ]);
  });

  it("rounds distances to 0.5 km and never returns coordinates (S-07)", async () => {
    const { body } = await search({ pin: "302029" });
    const near = body.items[0];
    expect(near.distanceKm).toBe(1);
    expect(body.items.map((i: { distanceKm: number }) => (i.distanceKm * 2) % 1)).toEqual([0, 0, 0]);
    expect(JSON.stringify(body)).not.toMatch(/"(lat|lng|location)"/);
    expect(near).toMatchObject({
      name: "Mahindra 575 DI",
      ownerShortName: "Ramesh P.",
      unit: "hour",
      priceRupees: 900,
    });
  });

  it("job → machine mapping (UI-SPEC §12.3)", async () => {
    expect(order((await search({ pin: "302029", job: "rotavate" })).body)).toEqual(["near"]);
    expect(order((await search({ pin: "302029", job: "plough" })).body)).toEqual(["mid"]);
    expect(order((await search({ pin: "302029", job: "harvest" })).body)).toEqual(["harvester"]);
    expect(order((await search({ pin: "302029", job: "transport" })).body)).toEqual([]);
  });

  it("sorts cheapest (per-hour equivalent) and top rated (Bayesian)", async () => {
    expect(order((await search({ pin: "302029", sort: "cheapest" })).body)).toEqual([
      "mid",
      "near",
      "harvester",
    ]);
    const top = (await search({ pin: "302029", sort: "top_rated" })).body;
    expect(order(top)).toEqual(["mid", "near", "harvester"]);
    expect(top.items[0]).toMatchObject({ rating: 5, reviewCount: 6 });
    expect(top.items[2]).toMatchObject({ rating: null, reviewCount: 0 });
  });

  it("busy machines go last with the next free date (F-04, F-07)", async () => {
    const { body } = await search({ pin: "302029", from: inDays(10), to: inDays(10) });
    expect(order(body)).toEqual(["harvester", "mid", "near"]);
    const near = body.items[2];
    expect(near).toMatchObject({ available: false, nextFreeDate: inDays(12) });
    expect(body.items[0]).toMatchObject({ available: true, nextFreeDate: null });
    const morning = await search({ pin: "302029", from: inDays(12), to: inDays(12), slot: "morning" });
    expect(morning.body.items.every((i: { available: boolean }) => i.available)).toBe(true);
  });

  it("cursor paging: 20 per page by default, Show more until done, total stays", async () => {
    const p1 = (await search({ pin: "302029", limit: "2" })).body;
    expect(p1).toMatchObject({ total: 3, nextCursor: "2" });
    const p2 = (await search({ pin: "302029", limit: "2", cursor: p1.nextCursor })).body;
    expect(order(p2)).toEqual(["mid"]);
    expect(p2.nextCursor).toBeNull();
    const past = (await search({ pin: "302029", limit: "2", cursor: "50" })).body;
    expect(past).toMatchObject({ items: [], total: 3, nextCursor: null });
  });

  it("unknown places are a 404 with a field; bad params a 400 (F-40); hostile input never 500", async () => {
    expect((await search({ pin: "999999" })).body).toMatchObject({ code: "place_not_found", field: "pin" });
    expect((await search({ pin: "302029", radius: "50" })).body).toMatchObject({
      code: "invalid_request",
      field: "radius",
    });
    const hostile: Record<string, string>[] = [
      { pin: "302029' OR '1'='1" },
      { village: "'; DROP TABLE machines; --" },
      { lat: "NaN", lng: "NaN" },
      { lat: "1e309", lng: "75" },
      { lat: "२६.९", lng: "७५.८" },
      { pin: "302029", limit: "99999999999999999999" },
      { pin: "302029", cursor: "-1" },
      { pin: "302029", from: "2026-13-40", to: "2026-13-41" },
      { pin: "302029", sort: "price; DELETE FROM machines" },
      { pin: "302029", extra: "x" },
    ];
    for (const q of hostile) {
      const { status } = await search(q);
      expect(status, JSON.stringify(q)).toBeLessThan(500);
    }
    // Devanagari coordinates are understood, not rejected
    expect((await search({ lat: "२६.९", lng: "७५.८" })).status).toBe(200);
    const [{ n }] = await t.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM machines`;
    expect(n).toBe(6);
  });
});

describe("GET /api/machines/[id] (detail)", () => {
  const detail = async (id: string, user: TestUser = viewer) => {
    const r = await detailRoute(req(`/api/machines/${id}`, { headers: { cookie: user.cookie } }), {
      params: Promise.resolve({ id }),
    });
    return { status: r.status, body: await r.json() };
  };

  it("returns 14 days of availability from today", async () => {
    const { status, body } = await detail(ids.near);
    expect(status).toBe(200);
    expect(body.days14).toHaveLength(14);
    const byDate = Object.fromEntries(
      body.days14.map((d: { date: string; state: string }) => [d.date, d.state]),
    );
    expect(byDate[inDays(10)]).toBe("busy");
    expect(byDate[inDays(11)]).toBe("blocked");
    expect(byDate[inDays(12)]).toBe("free");
    expect(body.owner).toMatchObject({ shortName: "Ramesh P." });
    expect(body).not.toHaveProperty("distanceKm");
  });

  it("inactive or unknown machines are 404", async () => {
    expect((await detail(ids.paused)).status).toBe(404);
    expect((await detail(crypto.randomUUID())).status).toBe(404);
    expect((await detail("../../etc/passwd")).status).toBe(404);
  });
});
