// @vitest-environment node
// Booking API against real Postgres + PostGIS, through the route handlers (session cookie → service → DB).
import { GET as listRoute, POST as createRoute } from "@/app/api/bookings/route";
import { GET as getRoute } from "@/app/api/bookings/[id]/route";
import { POST as acceptRoute } from "@/app/api/bookings/[id]/accept/route";
import { POST as cancelRoute } from "@/app/api/bookings/[id]/cancel/route";
import { POST as declineRoute } from "@/app/api/bookings/[id]/decline/route";
import { POST as payRoute } from "@/app/api/bookings/[id]/pay/route";
import { inDays, json, makeMachine, makeUser, req, type TestUser } from "./test/fixtures";
import { createTestDb, type TestDb } from "./test/pg";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
  process.env.DEMO_PAYMENT_DELAY_MS = "0";
});
afterAll(async () => {
  delete process.env.DEMO_PAYMENT_FAIL;
  await t.drop();
});

const params = <P>(p: P) => ({ params: Promise.resolve(p) });
const none = params<Record<string, never>>({});
const key = () => crypto.randomUUID();

function book(user: TestUser | null, body: Record<string, unknown>, k: string | null = key()) {
  return createRoute(
    req("/api/bookings", json(body, { cookie: user?.cookie, headers: k ? { "idempotency-key": k } : {} })),
    none,
  );
}
const post = (fn: typeof acceptRoute, user: TestUser | null, id: string, body: unknown = {}) =>
  fn(req(`/api/bookings/${id}/x`, json(body, { cookie: user?.cookie })), params({ id }));
const get = (user: TestUser | null, id: string) =>
  getRoute(req(`/api/bookings/${id}`, { headers: user ? { cookie: user.cookie } : {} }), params({ id }));

async function setup() {
  const owner = await makeUser(["owner"]);
  const renter = await makeUser(["renter"]);
  const machineId = await makeMachine(owner.id);
  return { owner, renter, machineId };
}
const day = (n: number) => ({ startDate: inDays(n), endDate: inDays(n), slot: "full" });

describe("POST /api/bookings", () => {
  it("401 without a session, with the one error shape", async () => {
    const { machineId } = await setup();
    const r = await book(null, { machineId, ...day(3) });
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ code: "unauthorized", message: "errors.api.unauthorized" });
  });

  it("creates a REQUESTED booking with a KR code, server-side quote and a 2-hour reply window", async () => {
    const { renter, machineId } = await setup();
    const r = await book(renter, {
      machineId,
      startDate: inDays(3),
      endDate: inDays(4),
      slot: "full",
      qty: 10,
    });
    expect(r.status).toBe(201);
    const b = await r.json();
    expect(b).toMatchObject({
      status: "REQUESTED",
      code: expect.stringMatching(/^KR-\d{4}$/),
      role: "renter",
    });
    expect(b).toMatchObject({ qty: 10, rentPaise: 750_000, depositPaise: 320_000, totalPaise: 750_000 });
    expect(new Date(b.replyBy).getTime() - Date.now()).toBeGreaterThan(119 * 60_000);
    expect(b.owner.phone).toBeNull();
    expect(b.location).toBeNull();
  });

  it("rejects past dates, a missing key, renterId in the body and booking your own machine", async () => {
    const { owner, renter, machineId } = await setup();
    expect((await (await book(renter, { machineId, ...day(-2) })).json()).code).toBe("past_date");
    expect((await book(renter, { machineId, ...day(3) }, null)).status).toBe(400);
    const spoof = await book(renter, { machineId, ...day(3), renterId: owner.id });
    expect(spoof.status).toBe(400);
    expect((await (await book(owner, { machineId, ...day(3) })).json()).code).toBe("own_machine");
  });

  it("idempotent replay returns the same booking (200) and doesn't create a second", async () => {
    const { renter, machineId } = await setup();
    const k = key();
    const a = await book(renter, { machineId, ...day(5) }, k);
    const b = await book(renter, { machineId, ...day(5) }, k);
    expect(a.status).toBe(201);
    expect(b.status).toBe(200);
    expect((await b.json()).id).toBe((await a.json()).id);
    const [{ n }] = await t.sql<
      { n: number }[]
    >`SELECT count(*)::int AS n FROM bookings WHERE machine_id = ${machineId}`;
    expect(n).toBe(1);
  });

  it("10 parallel replays of one key → one booking", async () => {
    const { renter, machineId } = await setup();
    const k = key();
    const rs = await Promise.all(Array.from({ length: 10 }, () => book(renter, { machineId, ...day(6) }, k)));
    const ids = new Set(await Promise.all(rs.map(async (r) => (await r.json()).id)));
    expect(ids.size).toBe(1);
    expect(rs.every((r) => r.status === 200 || r.status === 201)).toBe(true);
  });

  it("another user's key is a conflict, not a leak", async () => {
    const { renter, machineId } = await setup();
    const other = await makeUser();
    const k = key();
    await book(renter, { machineId, ...day(7) }, k);
    const r = await book(other, { machineId, ...day(8) }, k);
    expect(r.status).toBe(409);
    expect((await r.json()).code).toBe("idempotency_conflict");
  });

  it("20 parallel requests for the same machine and slot → exactly 1 succeeds, 19 get 409", async () => {
    const owner = await makeUser(["owner"]);
    const machineId = await makeMachine(owner.id);
    const renters = await Promise.all(Array.from({ length: 20 }, () => makeUser()));
    const rs = await Promise.all(renters.map((r) => book(r, { machineId, ...day(10) })));
    const statuses = rs.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(19);
    const bodies = await Promise.all(rs.filter((r) => r.status === 409).map((r) => r.json()));
    expect(new Set(bodies.map((b) => b.code))).toEqual(new Set(["machine_unavailable"]));
    const [{ n }] = await t.sql<
      { n: number }[]
    >`SELECT count(*)::int AS n FROM bookings WHERE machine_id = ${machineId}`;
    expect(n).toBe(1);
  });

  it("overlapping ranges conflict; back-to-back slots on the same day don't", async () => {
    const { renter, machineId } = await setup();
    const other = await makeUser();
    expect(
      (await book(renter, { machineId, startDate: inDays(12), endDate: inDays(14), slot: "full" })).status,
    ).toBe(201);
    expect((await book(other, { machineId, ...day(13) })).status).toBe(409);
    expect(
      (await book(other, { machineId, startDate: inDays(20), endDate: inDays(20), slot: "morning" })).status,
    ).toBe(201);
    expect(
      (await book(renter, { machineId, startDate: inDays(20), endDate: inDays(20), slot: "afternoon" }))
        .status,
    ).toBe(201);
  });

  it("blocked days are unavailable", async () => {
    const { renter, machineId } = await setup();
    await t.sql`INSERT INTO machine_blocks (machine_id, day) VALUES (${machineId}, ${inDays(15)})`;
    expect(
      (
        await (
          await book(renter, { machineId, startDate: inDays(14), endDate: inDays(16), slot: "full" })
        ).json()
      ).code,
    ).toBe("machine_unavailable");
  });

  it("rate-limits booking attempts to 5 per hour per user (S-02)", async () => {
    const owner = await makeUser(["owner"]);
    const renter = await makeUser();
    const machines = await Promise.all(Array.from({ length: 6 }, () => makeMachine(owner.id)));
    const rs = [];
    for (const m of machines) rs.push((await book(renter, { machineId: m, ...day(30) })).status);
    expect(rs).toEqual([201, 201, 201, 201, 201, 429]);
  });

  it("hostile inputs never 500", async () => {
    const { renter, machineId } = await setup();
    const bad: Record<string, unknown>[] = [
      { machineId: "'; DROP TABLE bookings; --", ...day(3) },
      { machineId, startDate: "२०२६-११-०२", endDate: "2026-11-02", slot: "full" },
      { machineId, ...day(3), qty: 1e308 },
      { machineId, ...day(3), qty: -1 },
      { machineId, ...day(3), qty: "NaN" },
      { machineId, ...day(3), slot: { $ne: null } },
      { machineId, startDate: inDays(3), endDate: inDays(400), slot: "full" },
      { machineId: crypto.randomUUID(), ...day(3) },
      { machineId, startDate: "9999-12-31", endDate: "9999-12-31", slot: "full" },
    ];
    for (const b of bad) {
      const r = await book(renter, b);
      expect(r.status, JSON.stringify(b)).toBeGreaterThanOrEqual(400);
      expect(r.status, JSON.stringify(b)).toBeLessThan(500);
    }
    const raw = await createRoute(
      req("/api/bookings", {
        method: "POST",
        headers: { cookie: renter.cookie, "content-type": "application/json", "idempotency-key": key() },
        body: "{not json",
      }),
      none,
    );
    expect(raw.status).toBe(400);
    const xorigin = await createRoute(
      req(
        "/api/bookings",
        json(
          { machineId, ...day(3) },
          { cookie: renter.cookie, headers: { origin: "https://evil.example", "idempotency-key": key() } },
        ),
      ),
      none,
    );
    expect(xorigin.status).toBe(403);
  });
});

describe("reading bookings (ownership)", () => {
  it("renter and owner can read it; anyone else gets 404; the list shows only mine", async () => {
    const { owner, renter, machineId } = await setup();
    const stranger = await makeUser(["owner"]);
    const b = await (await book(renter, { machineId, ...day(4) })).json();
    expect((await get(renter, b.id)).status).toBe(200);
    expect((await (await get(owner, b.id)).json()).role).toBe("owner");
    expect((await get(stranger, b.id)).status).toBe(404);
    expect((await get(null, b.id)).status).toBe(401);
    expect((await get(renter, "not-a-uuid")).status).toBe(404);
    const list = await (
      await listRoute(req("/api/bookings", { headers: { cookie: stranger.cookie } }), none)
    ).json();
    expect(list.items).toEqual([]);
  });
});

describe("owner accept / decline (UI-SPEC §4.12)", () => {
  it("only the machine's owner may accept: renter 403, stranger 404; then phones are shared", async () => {
    const { owner, renter, machineId } = await setup();
    const stranger = await makeUser(["owner"]);
    await t.sql`UPDATE users SET phone = ${`+9198${String(Date.now()).slice(-8)}`} WHERE id = ${owner.id}`;
    const b = await (await book(renter, { machineId, ...day(4) })).json();
    expect((await post(acceptRoute, renter, b.id)).status).toBe(403);
    expect((await post(acceptRoute, stranger, b.id)).status).toBe(404);
    const ok = await post(acceptRoute, owner, b.id);
    expect(ok.status).toBe(200);
    expect((await ok.json()).status).toBe("CONFIRMED");
    const seen = await (await get(renter, b.id)).json();
    expect(seen.owner.phone).toMatch(/^\+91/);
    expect(seen.location).toMatchObject({ lat: expect.any(Number), lng: expect.any(Number) });
    expect((await post(acceptRoute, owner, b.id)).status).toBe(409);
    const [n] =
      await t.sql`SELECT 1 FROM notifications WHERE user_id = ${renter.id} AND type = 'booking_accepted'`;
    expect(n).toBeTruthy();
  });

  it("decline needs a reason and frees the slot", async () => {
    const { owner, renter, machineId } = await setup();
    const b = await (await book(renter, { machineId, ...day(4) })).json();
    expect((await post(declineRoute, owner, b.id, { reason: "lol" })).status).toBe(400);
    expect((await (await post(declineRoute, owner, b.id, { reason: "busy" })).json()).status).toBe(
      "DECLINED",
    );
    expect((await book(await makeUser(), { machineId, ...day(4) })).status).toBe(201);
  });

  it("after the 2-hour window the request expires: accept → 409 reply_window_closed, slot is free", async () => {
    const { owner, renter, machineId } = await setup();
    const b = await (await book(renter, { machineId, ...day(4) })).json();
    await t.sql`UPDATE bookings SET reply_by = now() - interval '1 second' WHERE id = ${b.id}`;
    const r = await post(acceptRoute, owner, b.id);
    expect(r.status).toBe(409);
    expect((await r.json()).code).toBe("reply_window_closed");
    expect((await book(await makeUser(), { machineId, ...day(4) })).status).toBe(201);
  });
});

describe("cancel (free until 24 h before the start)", () => {
  it("renter cancels a request for free; a stranger can't", async () => {
    const { renter, machineId } = await setup();
    const b = await (await book(renter, { machineId, ...day(5) })).json();
    expect((await post(cancelRoute, await makeUser(), b.id)).status).toBe(404);
    const r = await (await post(cancelRoute, renter, b.id, { reason: "rain" })).json();
    expect(r).toMatchObject({ refund: "full", booking: { status: "CANCELLED" } });
    expect((await post(cancelRoute, renter, b.id)).status).toBe(409);
  });

  it("inside 24 h the deposit is at risk", async () => {
    const { owner, renter, machineId } = await setup();
    const b = await (await book(renter, { machineId, ...day(1) })).json();
    await post(acceptRoute, owner, b.id);
    await t.sql`UPDATE bookings SET during = tstzrange(now() + interval '2 hours', now() + interval '8 hours', '[)') WHERE id = ${b.id}`;
    expect((await (await post(cancelRoute, renter, b.id)).json()).refund).toBe("deposit_at_risk");
  });

  it("owner can't cancel a request (he declines it) but can cancel a confirmed booking", async () => {
    const { owner, renter, machineId } = await setup();
    const b = await (await book(renter, { machineId, ...day(5) })).json();
    expect((await post(cancelRoute, owner, b.id)).status).toBe(409);
    await post(acceptRoute, owner, b.id);
    expect((await post(cancelRoute, owner, b.id, { reason: "tractor broke" })).status).toBe(200);
  });

  it("adversarial: bookings and cancellations interleaved by many users never double-book", async () => {
    const owner = await makeUser(["owner"]);
    const machineId = await makeMachine(owner.id);
    const users = await Promise.all(Array.from({ length: 12 }, () => makeUser()));
    for (let round = 0; round < 4; round++) {
      const rs = await Promise.all(users.map((u) => book(u, { machineId, ...day(40) })));
      const won = rs.filter((r) => r.status === 201);
      expect(won).toHaveLength(1);
      expect(rs.filter((r) => r.status === 409)).toHaveLength(users.length - 1);
      const b = await won[0].json();
      // the winner cancels while everyone else retries at once
      const [{ renter_id }] = await t.sql<
        { renter_id: string }[]
      >`SELECT renter_id FROM bookings WHERE id = ${b.id}`;
      const w = users.find((u) => u.id === renter_id)!;
      await Promise.all([
        post(cancelRoute, w, b.id),
        ...users.filter((u) => u !== w).map((u) => book(u, { machineId, ...day(40) })),
      ]);
      await t.sql`UPDATE bookings SET status = 'CANCELLED' WHERE machine_id = ${machineId} AND status = 'REQUESTED'`;
      await t.sql`DELETE FROM rate_limits`;
    }
    const [{ overlaps }] = await t.sql<{ overlaps: number }[]>`
      SELECT count(*)::int AS overlaps FROM bookings a JOIN bookings b ON a.machine_id = b.machine_id AND a.id < b.id
      WHERE a.machine_id = ${machineId} AND a.during && b.during
        AND a.status IN ('REQUESTED','CONFIRMED','IN_PROGRESS') AND b.status IN ('REQUESTED','CONFIRMED','IN_PROGRESS')`;
    expect(overlaps).toBe(0);
  }, 30_000);
});

describe("mock payment (D-08)", () => {
  it("pay later and paid_demo; amount must match; no double payment; owner can't pay", async () => {
    const { owner, renter, machineId } = await setup();
    const b = await (await book(renter, { machineId, ...day(5) })).json();
    expect((await post(payRoute, owner, b.id, { method: "upi", amountPaise: b.totalPaise })).status).toBe(
      403,
    );
    expect((await post(payRoute, renter, b.id, { method: "upi", amountPaise: 1 })).status).toBe(400);
    expect(
      (
        await post(payRoute, renter, b.id, {
          method: "card",
          amountPaise: b.totalPaise,
          cardNumber: "4111111111111111",
        })
      ).status,
    ).toBe(400);
    const ok = await post(payRoute, renter, b.id, { method: "upi", amountPaise: b.totalPaise });
    expect(await ok.json()).toMatchObject({ status: "paid_demo", method: "upi" });
    expect((await post(payRoute, renter, b.id, { method: "cash", amountPaise: b.totalPaise })).status).toBe(
      409,
    );
    const b2 = await (await book(renter, { machineId, ...day(6) })).json();
    expect(
      (await (await post(payRoute, renter, b2.id, { method: "cash", amountPaise: b2.totalPaise })).json())
        .status,
    ).toBe("pay_later");
  });

  it("DEMO_PAYMENT_FAIL=true records a failure and allows a retry", async () => {
    const { renter, machineId } = await setup();
    const b = await (await book(renter, { machineId, ...day(5) })).json();
    process.env.DEMO_PAYMENT_FAIL = "true";
    const r = await post(payRoute, renter, b.id, { method: "net", amountPaise: b.totalPaise });
    delete process.env.DEMO_PAYMENT_FAIL;
    expect(r.status).toBe(402);
    expect((await r.json()).code).toBe("payment_failed");
    expect((await post(payRoute, renter, b.id, { method: "net", amountPaise: b.totalPaise })).status).toBe(
      200,
    );
  });
});
