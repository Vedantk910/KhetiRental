import fc from "fast-check";
import {
  createEscrow,
  escrowReducer,
  totalPaise,
  type EscrowEvent,
  type EscrowState,
} from "./escrow-machine";

// 10 contracted hours at ₹1,000/h → base ₹10,000, deposit 15 % = ₹1,500.
const fresh = () => createEscrow({ hourlyRateInr: 1000, contractedHours: 10, takeRate: 0.135 });
const goodHandover: EscrowEvent = {
  type: "HANDOVER",
  photos: 3,
  photosWithinM: 120,
  h0: 500,
  ownerOtp: true,
  renterOtp: true,
  kycOk: true,
};
const run = (events: EscrowEvent[], s = fresh()) => events.reduce(escrowReducer, s);
const active = () => run([{ type: "AUTHORIZE" }, goodHandover]);

describe("pre-authorisation", () => {
  it("holds 100 % rental + 15 % deposit", () => {
    const s = fresh();
    expect(s.stage).toBe("PRE_AUTH");
    expect(s.ledger.escrow).toBe(1_150_000); // paise
    expect(s.renterPaidPaise).toBe(1_150_000);
  });

  it("applies the HP-tier deposit floor when it exceeds 15 % (contract §5)", () => {
    const s = createEscrow({ hourlyRateInr: 1000, contractedHours: 10, takeRate: 0.135, depositFloorInr: 3200 });
    expect(s.depositPaise).toBe(320_000);
    expect(s.renterPaidPaise).toBe(1_320_000);
    const low = createEscrow({ hourlyRateInr: 1000, contractedHours: 10, takeRate: 0.135, depositFloorInr: 500 });
    expect(low.depositPaise).toBe(150_000);
  });

  it("rejects a hostile deposit floor", () => {
    for (const f of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => createEscrow({ hourlyRateInr: 1000, contractedHours: 10, takeRate: 0.135, depositFloorInr: f })).toThrow();
    }
  });

  it("rejects invalid terms", () => {
    expect(() => createEscrow({ hourlyRateInr: -1, contractedHours: 10, takeRate: 0.135 })).toThrow();
    expect(() => createEscrow({ hourlyRateInr: 1000, contractedHours: 0, takeRate: 0.135 })).toThrow();
    expect(() => createEscrow({ hourlyRateInr: 1000, contractedHours: 10, takeRate: 0.5 })).toThrow();
  });
});

describe("stage 1 handover gate (P1)", () => {
  it.each([
    ["fewer than 3 photos", { photos: 2 }],
    ["photos > 500 m from the lot", { photosWithinM: 800 }],
    ["owner OTP missing", { ownerOtp: false }],
    ["renter OTP missing", { renterOtp: false }],
  ])("stays in HANDOVER when %s", (_, patch) => {
    const s = run([{ type: "AUTHORIZE" }, { ...goodHandover, ...patch } as EscrowEvent]);
    expect(s.stage).toBe("HANDOVER");
    expect(s.error).toBeTruthy();
  });

  it("locks H0 and goes ACTIVE when all checks pass", () => {
    const s = active();
    expect(s.stage).toBe("ACTIVE");
    expect(s.h0).toBe(500);
  });

  it("D-07: KYC mismatch cancels with a full refund", () => {
    const s = run([{ type: "AUTHORIZE" }, { ...goodHandover, kycOk: false }]);
    expect(s.stage).toBe("CANCELLED");
    expect(s.ruleFired).toBe("D-07");
    expect(s.ledger.renterRefund).toBe(1_150_000);
  });

  it("D-06: no-show refunds the renter in full", () => {
    const s = run([{ type: "AUTHORIZE" }, { type: "NO_SHOW" }]);
    expect(s.stage).toBe("CANCELLED");
    expect(s.ruleFired).toBe("D-06");
    expect(s.ledger.renterRefund).toBe(1_150_000);
  });
});

describe("stage 2 telematics window", () => {
  it("D-01 needs > 500 m AND ≥ 60 s outside (single GPS drift is not a breach)", () => {
    expect(run([{ type: "TELEMETRY", distanceOutsideM: 900, secondsOutside: 20, ecuHours: 1, gpsHours: 1 }], active()).stage).toBe("ACTIVE");
    expect(run([{ type: "TELEMETRY", distanceOutsideM: 500, secondsOutside: 300, ecuHours: 1, gpsHours: 1 }], active()).stage).toBe("ACTIVE");
    const s = run([{ type: "TELEMETRY", distanceOutsideM: 501, secondsOutside: 60, ecuHours: 1, gpsHours: 1 }], active());
    expect(s.stage).toBe("DISPUTE_OPEN");
    expect(s.ruleFired).toBe("D-01");
    expect(s.depositFrozen).toBe(true);
  });

  it("D-02 fires above 10 % ECU/GPS divergence, not at exactly 10 %", () => {
    expect(run([{ type: "TELEMETRY", distanceOutsideM: 0, secondsOutside: 0, ecuHours: 11, gpsHours: 10 }], active()).stage).toBe("ACTIVE");
    const s = run([{ type: "TELEMETRY", distanceOutsideM: 0, secondsOutside: 0, ecuHours: 11.2, gpsHours: 10 }], active());
    expect(s.stage).toBe("DISPUTE_OPEN");
    expect(s.ruleFired).toBe("D-02");
  });

  it("rejects non-finite or negative telemetry instead of trusting it", () => {
    const s = run([{ type: "TELEMETRY", distanceOutsideM: Number.NaN, secondsOutside: 0, ecuHours: 1, gpsHours: 1 }], active());
    expect(s.stage).toBe("ACTIVE");
    expect(s.error).toMatch(/telemetry/i);
  });
});

describe("stage 3 return audit and settlement", () => {
  const settle = (hFinal: number, extra: Partial<Extract<EscrowEvent, { type: "RETURN" }>> = {}) =>
    run([{ type: "RETURN", hFinal, fuelOk: true, damageOk: true, ...extra }, { type: "SETTLE" }], active());

  it("bills verified ΔH only, takes 13.5 %, refunds the rest", () => {
    const s = settle(508); // ΔH = 8 of 10 contracted hours
    expect(s.stage).toBe("SETTLED");
    expect(s.ledger.owner).toBe(Math.round(800_000 * 0.865));
    expect(s.ledger.platform).toBe(800_000 - Math.round(800_000 * 0.865));
    expect(s.ledger.renterRefund).toBe(1_150_000 - 800_000);
    expect(s.ledger.escrow).toBe(0);
  });

  it("tolerates up to +10 % overrun at no extra charge", () => {
    expect(settle(511).ledger.renterRefund).toBe(150_000);
  });

  it("D-03 charges every excess hour from the deposit beyond +10 %, capped at the deposit", () => {
    const s = settle(512); // ΔH 12 → 2 excess hours = ₹2,000 but deposit is ₹1,500
    expect(s.ruleFired).toBe("D-03");
    expect(s.ledger.renterRefund).toBe(0);
    expect(s.ledger.owner + s.ledger.platform).toBe(1_150_000);
  });

  it("meter rollback (hFinal < H0) is treated as tampering (D-02)", () => {
    const s = run([{ type: "RETURN", hFinal: 450, fuelOk: true, damageOk: true }], active());
    expect(s.stage).toBe("DISPUTE_OPEN");
    expect(s.ruleFired).toBe("D-02");
  });

  it("D-04 fuel and D-05 damage open disputes instead of settling", () => {
    expect(settle(508, { fuelOk: false }).ruleFired).toBe("D-04");
    expect(settle(508, { damageOk: false }).stage).toBe("DISPUTE_OPEN");
  });
});

describe("dispute resolution", () => {
  const breached = () =>
    run([{ type: "TELEMETRY", distanceOutsideM: 900, secondsOutside: 120, ecuHours: 1, gpsHours: 1 }], active());

  it("renter at fault: deposit forfeits to owner", () => {
    const s = run([{ type: "RESOLVE", ruling: "renter_at_fault" }], breached());
    expect(s.stage).toBe("SETTLED");
    expect(s.ledger.renterRefund).toBe(0);
    expect(s.ledger.owner).toBe(Math.round(1_000_000 * 0.865) + 150_000);
  });

  it("owner at fault: renter refunded in full", () => {
    const s = run([{ type: "RESOLVE", ruling: "owner_at_fault" }], breached());
    expect(s.ledger.renterRefund).toBe(1_150_000);
    expect(s.ledger.owner).toBe(0);
  });

  it("cannot settle while a dispute is open", () => {
    const s = run([{ type: "SETTLE" }], breached());
    expect(s.stage).toBe("DISPUTE_OPEN");
    expect(s.ledger.owner).toBe(0);
  });
});

describe("idempotency", () => {
  it("replaying SETTLE does not pay twice", () => {
    const once = run([{ type: "RETURN", hFinal: 508, fuelOk: true, damageOk: true }, { type: "SETTLE" }], active());
    const twice = run([{ type: "SETTLE" }, { type: "SETTLE" }], once);
    expect(twice.ledger).toEqual(once.ledger);
  });
});

// Adversarial multi-actor simulation: renter, owner, field device and platform
// fire random, replayed and out-of-order events. Whatever happens, money is
// conserved, nothing goes negative, terminal states stay terminal and the owner
// is never paid while a dispute is open.
describe("multi-actor adversarial properties", () => {
  const num = fc.oneof(fc.double({ min: -100, max: 2000, noNaN: false }), fc.constant(Number.NaN));
  const event: fc.Arbitrary<EscrowEvent> = fc.oneof(
    fc.constant<EscrowEvent>({ type: "AUTHORIZE" }),
    fc.record({
      type: fc.constant("HANDOVER" as const),
      photos: fc.integer({ min: 0, max: 6 }),
      photosWithinM: fc.integer({ min: 0, max: 1000 }),
      h0: fc.integer({ min: 0, max: 2000 }),
      ownerOtp: fc.boolean(),
      renterOtp: fc.boolean(),
      kycOk: fc.boolean(),
    }),
    fc.constant<EscrowEvent>({ type: "NO_SHOW" }),
    fc.record({
      type: fc.constant("TELEMETRY" as const),
      distanceOutsideM: num,
      secondsOutside: num,
      ecuHours: num,
      gpsHours: num,
    }),
    fc.record({ type: fc.constant("RETURN" as const), hFinal: num, fuelOk: fc.boolean(), damageOk: fc.boolean() }),
    fc.constant<EscrowEvent>({ type: "SETTLE" }),
    fc.record({
      type: fc.constant("RESOLVE" as const),
      ruling: fc.constantFrom("renter_at_fault" as const, "owner_at_fault" as const),
    }),
  );

  it("conserves money and never pays out mid-dispute", () => {
    fc.assert(
      fc.property(fc.array(event, { maxLength: 40 }), fc.integer({ min: 0, max: 20_000 }), (events, floor) => {
        let s: EscrowState = createEscrow({ hourlyRateInr: 1000, contractedHours: 10, takeRate: 0.135, depositFloorInr: floor });
        for (const e of events) {
          const prev = s;
          s = escrowReducer(s, e);
          const l = s.ledger;
          if (totalPaise(l) !== s.renterPaidPaise) return false;
          if (Object.values(l).some((v) => v < 0 || !Number.isInteger(v))) return false;
          if ((prev.stage === "SETTLED" || prev.stage === "CANCELLED") && s.ledger !== prev.ledger) return false;
          if (s.stage === "DISPUTE_OPEN" && l.owner !== 0) return false;
        }
        return true;
      }),
      { numRuns: 2000 },
    );
  });
});
