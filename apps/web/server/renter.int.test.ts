// @vitest-environment node
// M4 server pieces (places, driver filter, reviews, booking by code, calendar file, cancel after start)
// against real Postgres + PostGIS, through the route handlers, with many users trying to break each one.
import { GET as placesRoute } from "@/app/api/places/route";
import { GET as searchRoute } from "@/app/api/machines/route";
import { GET as reviewsRoute } from "@/app/api/machines/[id]/reviews/route";
import { GET as byCodeRoute } from "@/app/api/bookings/by-code/[code]/route";
import { GET as icsRoute } from "@/app/api/bookings/[id]/ics/route";
import { POST as cancelRoute } from "@/app/api/bookings/[id]/cancel/route";
import { POST as createRoute } from "@/app/api/bookings/route";
import { POST as acceptRoute } from "@/app/api/bookings/[id]/accept/route";
import { inDays, json, makeMachine, makeUser, req, type TestUser } from "./test/fixtures";
import { createTestDb, type TestDb } from "./test/pg";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
  await t.sql`INSERT INTO pin_codes (pin, office, village, district, state, location) VALUES
    ('413512', 'Latur H.O', 'Latur', 'Latur', 'Maharashtra', ST_SetSRID(ST_MakePoint(76.5604, 18.4088), 4326)::geography),
    ('413513', 'Chakur S.O', 'Chakur', 'Latur', 'Maharashtra', ST_SetSRID(ST_MakePoint(76.8783, 18.5122), 4326)::geography),
    ('413520', 'Ausa S.O', 'Ausa', 'Latur', 'Maharashtra', ST_SetSRID(ST_MakePoint(76.4977, 18.2459), 4326)::geography)`;
});
afterAll(() => t.drop());

const p = <P>(x: P) => ({ params: Promise.resolve(x) });
const none = p<Record<string, never>>({});
const get = (
  fn: (r: Request, c: never) => Promise<Response>,
  path: string,
  user: TestUser | null,
  ctx: unknown = none,
) => fn(req(path, { headers: user ? { cookie: user.cookie } : {} }), ctx as never);

async function book(user: TestUser, machineId: string, offset = 3, over: Record<string, unknown> = {}) {
  const r = await createRoute(
    req(
      "/api/bookings",
      json(
        { machineId, startDate: inDays(offset), endDate: inDays(offset), slot: "full", qty: 4, ...over },
        { cookie: user.cookie, headers: { "idempotency-key": crypto.randomUUID() } },
      ),
    ),
    none,
  );
  return { status: r.status, body: await r.json() };
}

describe("GET /api/places (PIN and village autocomplete)", () => {
  const q = async (qs: string, user: TestUser | null) => {
    const r = await get(placesRoute, `/api/places?${qs}`, user);
    return { status: r.status, body: await r.json() };
  };
  it("needs a session", async () => {
    expect((await q("q=lat", null)).status).toBe(401);
  });
  it("matches a PIN prefix (3+ digits) and a village prefix (2+ letters), at most 8", async () => {
    const u = await makeUser();
    const pin = await q("q=4135", u);
    expect(pin.body.items.map((i: { pin: string }) => i.pin).sort()).toEqual(["413512", "413513", "413520"]);
    expect(pin.body.items[0]).toMatchObject({ label: expect.stringContaining(" · ") });
    const v = await q("q=la", u);
    expect(v.body.items.map((i: { village: string }) => i.village)).toEqual(["Latur"]);
    expect((await q("q=4", u)).body.items).toEqual([]);
    expect((await q("q=l", u)).body.items).toEqual([]);
    expect(Object.keys((await q("q=4135", u)).body.items[0]).sort()).toEqual(
      ["district", "label", "lat", "lng", "pin", "state", "village"].sort(),
    );
  });
  it("accepts Devanagari digits", async () => {
    const u = await makeUser();
    expect((await q("q=४१३५१२", u)).body.items[0].pin).toBe("413512");
  });
  it("treats % _ and quotes literally and never 500s on hostile input", async () => {
    const u = await makeUser();
    for (const bad of ["%25%25", "_%25", "'%3B DROP TABLE users--", "a".repeat(5000), "%00%00", "<script>"]) {
      const r = await q(`q=${bad}`, u);
      expect([200, 400], bad).toContain(r.status);
      if (r.status === 200) expect(r.body.items).toEqual([]);
    }
    expect((await q("", u)).status).toBe(400);
    expect((await q("q=la&lat=1&lng=2", u)).status).toBe(400);
  });
  it("lat/lng returns the nearest PIN centroid (for 'Near you')", async () => {
    const u = await makeUser();
    const r = await q("lat=18.51&lng=76.87", u);
    expect(r.body.item).toMatchObject({ pin: "413513", village: "Chakur" });
    expect((await q("lat=999&lng=1", u)).status).toBe(400);
    expect((await q("lat=abc&lng=1", u)).status).toBe(400);
  });
});

describe("search: With driver filter and the free count", () => {
  it("driver=1 keeps only machines that come with a driver; freeTotal counts the free ones", async () => {
    const owner = await makeUser(["owner"]);
    const viewer = await makeUser();
    const withDriver = await makeMachine(owner.id, { lat: 18.41, lng: 76.56 });
    const selfDrive = await makeMachine(owner.id, { lat: 18.411, lng: 76.56 });
    await t.sql`UPDATE machines SET operator_included = false WHERE id = ${selfDrive}`;
    const day = inDays(20);
    await book(viewer, withDriver, 20);
    const s = async (qs: string) => {
      const r = await get(searchRoute, `/api/machines?pin=413512&radius=5&${qs}`, viewer);
      return r.json();
    };
    const all = await s(`from=${day}&to=${day}`);
    const ids = all.items.map((i: { id: string }) => i.id);
    expect(ids).toContain(withDriver);
    expect(all.freeTotal).toBe(all.items.filter((i: { available: boolean }) => i.available).length);
    expect(all.freeTotal).toBeLessThan(all.total);
    const driver = await s("driver=1");
    expect(driver.items.map((i: { id: string }) => i.id)).toContain(withDriver);
    expect(driver.items.map((i: { id: string }) => i.id)).not.toContain(selfDrive);
    expect(driver.items.every((i: { operatorIncluded: boolean }) => i.operatorIncluded)).toBe(true);
    expect((await get(searchRoute, "/api/machines?pin=413512&driver=maybe", viewer)).status).toBe(400);
  });
});

describe("search: approximate map positions (S-07)", () => {
  it("map=1 adds positions rounded to ~1 km and the farm centre; without it no coordinates leave the server", async () => {
    const owner = await makeUser(["owner"]);
    const viewer = await makeUser();
    await makeMachine(owner.id, { lat: 18.40912345, lng: 76.56123456 });
    const plain = await (await get(searchRoute, "/api/machines?pin=413512&radius=5", viewer)).json();
    expect(JSON.stringify(plain)).not.toMatch(/mapLat|mapLng|center/);
    const map = await (await get(searchRoute, "/api/machines?pin=413512&radius=5&map=1", viewer)).json();
    const item = map.items.find((i: { village: string }) => i.village === "Latur");
    expect(item.mapLat).toBe(18.41);
    expect(item.mapLng).toBe(76.56);
    expect(map.place.center).toEqual({ lat: 18.409, lng: 76.56 });
    expect((await get(searchRoute, "/api/machines?pin=413512&map=2", viewer)).status).toBe(400);
  });
});

describe("GET /api/machines/[id]/reviews", () => {
  it("pages the owner's reviews, newest first, with short author names only", async () => {
    const owner = await makeUser(["owner"]);
    const m = await makeMachine(owner.id);
    const author = await makeUser();
    await t.sql`UPDATE users SET name = 'Sunil Pawar' WHERE id = ${author.id}`;
    for (let i = 0; i < 12; i++) {
      const [b] = await t.sql<{ id: string }[]>`
        INSERT INTO bookings (code, machine_id, renter_id, during, start_date, end_date, slot, est_qty, unit, rate_paise,
          rent_paise, deposit_paise, diesel_included, total_paise, status, reply_by, idempotency_key)
        VALUES ('KR-0001', ${m}, ${author.id}, tstzrange(now() - make_interval(days => ${i + 10}), now() - make_interval(days => ${i + 10}) + interval '1 hour'),
          '2026-01-01', '2026-01-01', 'full', 1, 'hour', 100, 100, 0, true, 100, 'COMPLETED', now(), ${crypto.randomUUID()})
        RETURNING id`;
      await t.sql`INSERT INTO reviews (booking_id, author_id, target_user_id, stars, text, created_at)
        VALUES (${b.id}, ${author.id}, ${owner.id}, 5, ${`Review ${i}`}, now() - make_interval(days => ${i}))`;
    }
    const viewer = await makeUser();
    const page1 = await (await get(reviewsRoute, `/api/machines/${m}/reviews`, viewer, p({ id: m }))).json();
    expect(page1.items).toHaveLength(10);
    expect(page1.items[0]).toMatchObject({ text: "Review 0", authorShortName: "Sunil P." });
    expect(JSON.stringify(page1)).not.toMatch(/Pawar|email|phone/);
    const page2 = await (
      await get(reviewsRoute, `/api/machines/${m}/reviews?cursor=${page1.nextCursor}`, viewer, p({ id: m }))
    ).json();
    expect(page2.items).toHaveLength(2);
    expect(page2.nextCursor).toBeNull();
    expect((await get(reviewsRoute, `/api/machines/${m}/reviews`, null, p({ id: m }))).status).toBe(401);
    expect((await get(reviewsRoute, "/api/machines/nope/reviews", viewer, p({ id: "nope" }))).status).toBe(
      404,
    );
    for (const c of ["-1", "abc", "99999999", "1e9"])
      expect(
        (await get(reviewsRoute, `/api/machines/${m}/reviews?cursor=${c}`, viewer, p({ id: m }))).status,
        c,
      ).toBe(400);
  });
  it("a paused machine's reviews are hidden from strangers", async () => {
    const owner = await makeUser(["owner"]);
    const m = await makeMachine(owner.id, { active: false });
    const viewer = await makeUser();
    expect((await get(reviewsRoute, `/api/machines/${m}/reviews`, viewer, p({ id: m }))).status).toBe(404);
    expect((await get(reviewsRoute, `/api/machines/${m}/reviews`, owner, p({ id: m }))).status).toBe(200);
  });
});

describe("GET /api/bookings/by-code/[code]", () => {
  it("the renter and the owner find it by code; strangers and bad codes get 404", async () => {
    const owner = await makeUser(["owner"]);
    const renter = await makeUser();
    const m = await makeMachine(owner.id);
    const { body } = await book(renter, m);
    const by = (u: TestUser | null, code: string) =>
      get(byCodeRoute, `/api/bookings/by-code/${code}`, u, p({ code }));
    const ok = await by(renter, body.code);
    expect(ok.status).toBe(200);
    expect((await ok.json()).id).toBe(body.id);
    expect((await by(owner, body.code.toLowerCase())).status).toBe(200);
    expect((await by(await makeUser(), body.code)).status).toBe(404);
    expect((await by(null, body.code)).status).toBe(401);
    for (const bad of ["KR-12", "KR-12345", "1; DROP", "KR-%00", "../etc", "kr-abcd"])
      expect((await by(renter, bad)).status, bad).toBe(404);
  });
  it("when two bookings reuse one code (old ones are closed) each user gets their own", async () => {
    const owner = await makeUser(["owner"]);
    const [a, b] = [await makeUser(), await makeUser()];
    const m = await makeMachine(owner.id);
    const first = (await book(a, m, 4)).body;
    await t.sql`UPDATE bookings SET status = 'CANCELLED' WHERE id = ${first.id}`;
    const second = (await book(b, m, 5)).body;
    await t.sql`UPDATE bookings SET status = 'CANCELLED' WHERE id = ${second.id}`;
    await t.sql`UPDATE bookings SET code = ${first.code} WHERE id = ${second.id}`;
    const by = async (u: TestUser) =>
      (
        await (
          await get(byCodeRoute, `/api/bookings/by-code/${first.code}`, u, p({ code: first.code }))
        ).json()
      ).id;
    expect(await by(a)).toBe(first.id);
    expect(await by(b)).toBe(second.id);
  });
});

describe("GET /api/bookings/[id]/ics", () => {
  it("gives the renter a calendar file once confirmed, with hostile machine names escaped", async () => {
    const owner = await makeUser(["owner"]);
    const renter = await makeUser();
    const m = await makeMachine(owner.id);
    await t.sql`UPDATE machines SET make = ${"Evil\r\nATTENDEE:mailto:x@y.z;,"} WHERE id = ${m}`;
    const { body } = await book(renter, m, 6);
    const ics = (u: TestUser | null) => get(icsRoute, `/api/bookings/${body.id}/ics`, u, p({ id: body.id }));
    expect((await ics(renter)).status).toBe(409); // not confirmed yet: no place to go
    await acceptRoute(req("/x", json({}, { cookie: owner.cookie })), p({ id: body.id }));
    const r = await ics(renter);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/text\/calendar/);
    expect(r.headers.get("content-disposition")).toMatch(/attachment; filename="KR-\d{4}\.ics"/);
    const text = await r.text();
    expect(text).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(text).toMatch(/DTSTART:\d{8}T\d{6}Z\r\n/);
    expect(text).not.toMatch(/\r\nATTENDEE/); // the CRLF in the name was neutralised
    expect((await ics(await makeUser())).status).toBe(404);
    expect((await ics(null)).status).toBe(401);
  });
});

describe("cancel after the start", () => {
  it("refuses to cancel once the job has started or the start time has passed", async () => {
    const owner = await makeUser(["owner"]);
    const renter = await makeUser();
    const m = await makeMachine(owner.id);
    const { body } = await book(renter, m, 2);
    await t.sql`UPDATE bookings SET status = 'CONFIRMED', during = tstzrange(now() - interval '2 hours', now() + interval '3 hours') WHERE id = ${body.id}`;
    const r = await cancelRoute(req("/x", json({}, { cookie: renter.cookie })), p({ id: body.id }));
    expect(r.status).toBe(409);
    expect((await r.json()).code).toBe("invalid_state");
    await t.sql`UPDATE bookings SET status = 'IN_PROGRESS' WHERE id = ${body.id}`;
    expect(
      (await cancelRoute(req("/x", json({}, { cookie: renter.cookie })), p({ id: body.id }))).status,
    ).toBe(409);
  });
});
