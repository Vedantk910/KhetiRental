import fc from "fast-check";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetStore, setBookingState } from "@/lib/marketplace-bookings";
import { POST as settle } from "../../escrow/[booking_id]/settle/route";
import { POST } from "./route";

// The settle route needs an admin session (S-03); the session lookup is stubbed per test.
const session = vi.hoisted(() => ({ user: null as null | { id: string; roles: string[] } }));
vi.mock("@/server/session", () => ({ currentUser: () => Promise.resolve(session.user) }));

const k = () => crypto.randomUUID();
const req = (body: unknown, key: string | null = k(), raw = false) =>
  new Request("http://x/api/demo/bookings", {
    method: "POST",
    headers: { "content-type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) },
    body: raw ? (body as string) : JSON.stringify(body),
  });
const ok = (o: Record<string, unknown> = {}) => ({
  machine_id: "M-001",
  renter_id: "r-1",
  hours: 4,
  start_at: "2026-11-02T06:00:00+05:30",
  ...o,
});

beforeEach(resetStore);

describe("POST /api/demo/bookings", () => {
  it("202 with a booking", async () => {
    const r = await POST(req(ok()));
    expect(r.status).toBe(202);
    expect(await r.json()).toMatchObject({ state: "ESCROW_AUTHORIZED" });
  });
  it("400 without or with a bad key, with Error shape", async () => {
    for (const key of [null, "nope"]) {
      const r = await POST(req(ok(), key));
      expect(r.status).toBe(400);
      expect(await r.json()).toMatchObject({ code: expect.any(String), message: expect.any(String) });
    }
  });
  it("400 on non-JSON and oversized bodies", async () => {
    expect((await POST(req("{oops", k(), true))).status).toBe(400);
    expect((await POST(req("x".repeat(1e6), k(), true))).status).toBe(400);
    expect((await POST(req(ok({ renter_id: "y".repeat(1e5) })))).status).toBe(400);
  });
  it("hostile bodies never 500", async () => {
    const hostile = fc.oneof(
      fc.anything(),
      fc.record({
        machine_id: fc.anything(),
        renter_id: fc.anything(),
        hours: fc.anything(),
        start_at: fc.anything(),
        activity: fc.anything(),
      }),
    );
    await fc.assert(
      fc.asyncProperty(hostile, async (b) => {
        const r = await POST(req(b));
        expect(r.status).toBeLessThan(500);
      }),
      { numRuns: 300 },
    );
    for (const hours of [0, -1, 1.5, 1e9, "3", null, [], {}, 1e308])
      expect((await POST(req(ok({ hours })))).status).toBe(400);
  });

  it("adversarial: 100 concurrent bookings, same machine and window, different keys -> exactly one 202", async () => {
    const rs = await Promise.all(
      Array.from({ length: 100 }, (_, i) => POST(req(ok({ renter_id: `r-${i}` })))),
    );
    const codes = rs.map((r) => r.status);
    expect(codes.filter((c) => c === 202)).toHaveLength(1);
    expect(codes.filter((c) => c === 409)).toHaveLength(99);
  });
  it("adversarial: 50 concurrent replays of one key -> one booking id", async () => {
    const key = k();
    const rs = await Promise.all(Array.from({ length: 50 }, () => POST(req(ok(), key))));
    const ids = new Set(await Promise.all(rs.map(async (r) => (await r.json()).booking_id)));
    expect(rs.every((r) => r.status === 202)).toBe(true);
    expect(ids.size).toBe(1);
  });
  it("same key with a different body is 409", async () => {
    const key = k();
    await POST(req(ok(), key));
    expect((await POST(req(ok({ hours: 9 }), key))).status).toBe(409);
  });
});

describe("POST /api/escrow/{id}/settle", () => {
  beforeEach(() => {
    session.user = { id: "admin-1", roles: ["admin"] };
  });
  it("401 without a session and 403 for non-admins", async () => {
    const { booking_id } = await (await POST(req(ok()))).json();
    setBookingState(booking_id, "POST_RETURN_AUDIT");
    session.user = null;
    expect((await call(booking_id)).status).toBe(401);
    session.user = { id: "r-1", roles: ["renter", "owner"] };
    const r = await call(booking_id);
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ code: "forbidden", message: "errors.api.forbidden" });
  });
  const call = (id: string, key: string | null = k()) =>
    settle(new Request("http://x", { method: "POST", headers: key ? { "Idempotency-Key": key } : {} }), {
      params: Promise.resolve({ booking_id: id }),
    });
  it("409 early, 200 when auditable, idempotent replay, 400 without key", async () => {
    const { booking_id } = await (await POST(req(ok()))).json();
    expect((await call(booking_id)).status).toBe(409);
    setBookingState(booking_id, "POST_RETURN_AUDIT");
    expect((await call(booking_id, null)).status).toBe(400);
    const key = k();
    const a = await call(booking_id, key);
    expect(a.status).toBe(200);
    const s = await a.json();
    expect(s).toMatchObject({ booking_id, platform_take_rate: 0.135 });
    expect(await (await call(booking_id, key)).json()).toEqual(s);
  });
  it("50 concurrent settles with distinct keys -> one 200", async () => {
    const { booking_id } = await (await POST(req(ok()))).json();
    setBookingState(booking_id, "POST_RETURN_AUDIT");
    const rs = await Promise.all(Array.from({ length: 50 }, () => call(booking_id)));
    expect(rs.filter((r) => r.status === 200)).toHaveLength(1);
    expect(rs.filter((r) => r.status === 409)).toHaveLength(49);
  });
});
