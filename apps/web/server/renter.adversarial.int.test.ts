// @vitest-environment node
// M4 adversarial: many renters, double submits, cross-user access by id and by code, hostile input.
import { GET as getRoute } from "@/app/api/bookings/[id]/route";
import { GET as icsRoute } from "@/app/api/bookings/[id]/ics/route";
import { GET as byCodeRoute } from "@/app/api/bookings/by-code/[code]/route";
import { GET as searchRoute } from "@/app/api/machines/route";
import { GET as placesRoute } from "@/app/api/places/route";
import { POST as acceptRoute } from "@/app/api/bookings/[id]/accept/route";
import { POST as cancelRoute } from "@/app/api/bookings/[id]/cancel/route";
import { POST as createRoute } from "@/app/api/bookings/route";
import { POST as payRoute } from "@/app/api/bookings/[id]/pay/route";
import { POST as problemRoute } from "@/app/api/bookings/[id]/problems/route";
import { inDays, json, makeMachine, makeUser, req, type TestUser } from "./test/fixtures";
import { createTestDb, type TestDb } from "./test/pg";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
  process.env.DEMO_PAYMENT_DELAY_MS = "0";
});
afterAll(() => t.drop());

const p = <P>(x: P) => ({ params: Promise.resolve(x) });
const none = p<Record<string, never>>({});
const book = (u: TestUser, machineId: string, offset: number) =>
  createRoute(
    req(
      "/api/bookings",
      json(
        { machineId, startDate: inDays(offset), endDate: inDays(offset), slot: "full", qty: 4 },
        { cookie: u.cookie, headers: { "idempotency-key": crypto.randomUUID() } },
      ),
    ),
    none,
  );
const post = (fn: typeof acceptRoute, u: TestUser, id: string, body: unknown = {}) =>
  fn(req(`/api/bookings/${id}/x`, json(body, { cookie: u.cookie })), p({ id }));
const get = (fn: (r: Request, c: never) => Promise<Response>, path: string, u: TestUser, id?: string) =>
  fn(req(path, { headers: { cookie: u.cookie } }), (id ? p({ id }) : none) as never);
const report = (u: TestUser, id: string, type: string, text = "late") => {
  const fd = new FormData();
  fd.set("type", type);
  fd.set("text", text);
  return problemRoute(
    req(`/api/bookings/${id}/problems`, { method: "POST", body: fd, headers: { cookie: u.cookie } }),
    p({ id }),
  );
};
async function setup() {
  const owner = await makeUser(["owner"]);
  const renter = await makeUser();
  const machineId = await makeMachine(owner.id);
  const b = await (await book(renter, machineId, 5)).json();
  return { owner, renter, machineId, b };
}

describe("renter B against renter A's booking", () => {
  it("cannot read, pay, cancel, report, or get the calendar file, by id or by code", async () => {
    const { renter, b, owner } = await setup();
    await post(acceptRoute, owner, b.id);
    const b2 = await makeUser();
    expect((await get(getRoute, `/api/bookings/${b.id}`, b2, b.id)).status).toBe(404);
    expect((await get(icsRoute, `/x`, b2, b.id)).status).toBe(404);
    expect((await get(byCodeRoute, `/x`, b2, undefined)).status).toBe(404);
    const byCode = await byCodeRoute(req("/x", { headers: { cookie: b2.cookie } }), p({ code: b.code }));
    expect(byCode.status).toBe(404);
    expect((await post(payRoute, b2, b.id, { method: "upi", amountPaise: b.totalPaise })).status).toBe(404);
    expect((await post(cancelRoute, b2, b.id)).status).toBe(404);
    expect((await report(b2, b.id, "no_show")).status).toBe(404);
    expect((await get(getRoute, `/api/bookings/${b.id}`, renter, b.id)).status).toBe(200);
  });
});

describe("double submits", () => {
  it("20 parallel pays → one payment; 20 parallel cancels → one cancellation and one notification", async () => {
    const { renter, owner, b } = await setup();
    const pays = await Promise.all(
      Array.from({ length: 20 }, () =>
        post(payRoute, renter, b.id, { method: "upi", amountPaise: b.totalPaise }),
      ),
    );
    expect(pays.filter((r) => r.status === 200)).toHaveLength(1);
    expect(pays.every((r) => r.status === 200 || r.status === 409)).toBe(true);
    const [{ n }] = await t.sql<
      { n: number }[]
    >`SELECT count(*)::int n FROM payments WHERE booking_id = ${b.id}`;
    expect(n).toBe(1);
    const cancels = await Promise.all(Array.from({ length: 20 }, () => post(cancelRoute, renter, b.id)));
    expect(cancels.filter((r) => r.status === 200)).toHaveLength(1);
    const [{ c }] = await t.sql<{ c: number }[]>`
      SELECT count(*)::int c FROM notifications WHERE user_id = ${owner.id} AND type = 'booking_cancelled'`;
    expect(c).toBe(1);
    expect((await post(payRoute, renter, b.id, { method: "cash", amountPaise: b.totalPaise })).status).toBe(
      409,
    );
  });
});

describe("a crowd racing for one machine and dates", () => {
  it("25 renters, one winner, everyone else 409", async () => {
    const owner = await makeUser(["owner"]);
    const machineId = await makeMachine(owner.id);
    const renters = await Promise.all(Array.from({ length: 25 }, () => makeUser()));
    const rs = await Promise.all(renters.map((u) => book(u, machineId, 9)));
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
    expect(rs.filter((r) => r.status === 409)).toHaveLength(24);
  });
});

describe("problem reports", () => {
  it("are rate-limited per user and hostile text never 500s", async () => {
    const { renter, b } = await setup();
    const codes: number[] = [];
    for (let i = 0; i < 15; i++) codes.push((await report(renter, b.id, "no_show")).status);
    expect(codes).toContain(429);
    expect(codes.filter((c) => c === 201).length).toBeLessThanOrEqual(10);
    const other = await setup();
    for (const text of ["x".repeat(100_000), "a\u0000b\u0007c", "'; DROP TABLE bookings;--", "‮‮"]) {
      const s = (await report(other.renter, other.b.id, "no_show", text)).status;
      expect([201, 400, 413]).toContain(s);
    }
  });
});

describe("cancel reason", () => {
  it("hostile text never 500s", async () => {
    const { renter, b } = await setup();
    for (const reason of ["a\u0000b", "x".repeat(50_000)])
      expect((await post(cancelRoute, renter, b.id, { reason })).status).toBeLessThan(500);
  });
});

describe("hostile search and places input", () => {
  it("never 500s", async () => {
    const u = await makeUser();
    const qs = [
      `place=${"x".repeat(5000)}`,
      "place=%00%07",
      "lat=NaN&lng=Infinity",
      "lat=999&lng=-999",
      "from=2025-13-45&to=bad",
      "acres=-5",
      "acres=1e999",
      "radius=-1",
      "limit=-1",
      "cursor=-3",
      "cursor=99999999999",
      "driver=maybe",
      "map=2",
    ];
    for (const q of qs) {
      const r = await get(searchRoute, `/api/machines?${q}`, u);
      expect(r.status, q).toBeLessThan(500);
    }
    for (const q of ["q=" + "9".repeat(5000), "q=%00", "lat=NaN&lng=1", "q=a&lat=1&lng=1", "q=%E0%A4"]) {
      const r = await get(placesRoute, `/api/places?${q}`, u);
      expect(r.status, q).toBeLessThan(500);
    }
  });
});
