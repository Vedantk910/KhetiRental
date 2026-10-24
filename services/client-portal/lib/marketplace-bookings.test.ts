import { beforeEach, describe, expect, it } from "vitest";
import { createBooking, resetStore, setBookingState, settleBooking, validateBookingCreate } from "./marketplace-bookings";
import { fleetMachine } from "./marketplace-fleet";
import { quoteRental } from "./marketplace-quote";
import { DEFAULT_TAKE_RATE } from "./pricing-engine";

const k = () => crypto.randomUUID();
const body = (o: Record<string, unknown> = {}) => ({ machine_id: "M-001", renter_id: "r-1", hours: 4, start_at: "2026-11-02T06:00:00+05:30", ...o });

beforeEach(resetStore);

describe("validateBookingCreate", () => {
  it("accepts a good body", () => expect(validateBookingCreate(body()).ok).toBe(true));
  it.each([
    [null], [[]], ["x"], [{}], [body({ hours: 0 })], [body({ hours: -1 })], [body({ hours: 1.5 })], [body({ hours: 1e9 })],
    [body({ hours: "4" })], [body({ hours: NaN })], [body({ machine_id: 5 })], [body({ machine_id: "" })], [body({ renter_id: "x".repeat(10_000) })],
    [body({ start_at: "not a date" })], [body({ start_at: 12 })], [body({ activity: "Dancing" })],
  ])("rejects %j", (b) => expect(validateBookingCreate(b).ok).toBe(false));
});

describe("createBooking", () => {
  it("rejects a missing or non-UUID key with 400", () => {
    for (const key of [null, "", "abc", "x".repeat(5000), "00000000-0000-0000-0000-00000000000g"]) {
      expect(createBooking(key, body()).status).toBe(400);
    }
  });
  it("accepts with 202 and ESCROW_AUTHORIZED", () => {
    const r = createBooking(k(), body());
    expect(r.status).toBe(202);
    expect(r.body).toMatchObject({ state: "ESCROW_AUTHORIZED", booking_id: expect.any(String) });
  });
  it("replays return the same booking", () => {
    const key = k();
    const a = createBooking(key, body());
    const b = createBooking(key, body());
    expect(b.status).toBe(202);
    expect(b.body).toEqual(a.body);
  });
  it("an unknown machine is 409 (not available), never priced as some other machine", () => {
    const r = createBooking(k(), body({ machine_id: "m-does-not-exist" }));
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ code: expect.any(String), message: expect.any(String) });
  });
  it("same key, different body is 409", () => {
    const key = k();
    createBooking(key, body());
    expect(createBooking(key, body({ hours: 5 })).status).toBe(409);
  });
  it("overlapping window on the same machine is 409; back-to-back and other machines are fine", () => {
    expect(createBooking(k(), body()).status).toBe(202);
    expect(createBooking(k(), body({ renter_id: "r-2", start_at: "2026-11-02T08:00:00+05:30" })).status).toBe(409);
    expect(createBooking(k(), body({ renter_id: "r-2", start_at: "2026-11-02T10:00:00+05:30" })).status).toBe(202);
    expect(createBooking(k(), body({ machine_id: "M-002" })).status).toBe(202);
  });
});

describe("settleBooking", () => {
  it("refunds the whole deposit, including a tier floor above 15 %, on a clean full-hours return", () => {
    const id = (createBooking(k(), body()).body as { booking_id: string }).booking_id;
    setBookingState(id, "POST_RETURN_AUDIT");
    const res = settleBooking(id, k()).body as { owner_share: number; renter_refund: number };
    const q = quoteRental(fleetMachine("M-001")!, "Sowing", 4);
    expect(res.renter_refund * 100).toBeCloseTo(q.depositPaise, 0);
    expect((res.owner_share * 100) / (1 - DEFAULT_TAKE_RATE)).toBeCloseTo(q.rentalPaise, -1);
  });
  const settleable = () => {
    const id = (createBooking(k(), body()).body as { booking_id: string }).booking_id;
    setBookingState(id, "POST_RETURN_AUDIT");
    return id;
  };
  it("rejects bad key 400, unknown booking 404", () => {
    expect(settleBooking("x", "nope").status).toBe(400);
    expect(settleBooking("x", k()).status).toBe(404);
  });
  it("409 when the booking is not in the audit state or is disputed", () => {
    const id = (createBooking(k(), body()).body as { booking_id: string }).booking_id;
    expect(settleBooking(id, k()).status).toBe(409);
    setBookingState(id, "DISPUTE_OPEN");
    expect(settleBooking(id, k()).status).toBe(409);
  });
  it("splits via the escrow machine and replays idempotently", () => {
    const id = settleable();
    const key = k();
    const a = settleBooking(id, key);
    expect(a.status).toBe(200);
    const s = a.body as { owner_share: number; renter_refund: number; platform_take_rate: number; booking_id: string };
    expect(s.booking_id).toBe(id);
    expect(s.platform_take_rate).toBe(0.135);
    expect(s.owner_share).toBeGreaterThan(0);
    expect(s.renter_refund).toBeGreaterThan(0); // the deposit
    expect(settleBooking(id, key)).toEqual(a);
    expect(settleBooking(id, k()).status).toBe(409); // already settled, new key
  });
});
