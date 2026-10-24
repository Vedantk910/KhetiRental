// 3-stage milestone escrow as a pure reducer (showcase/contracts/escrow-state-machine.md).
// Money is integer paise; the four ledger buckets always sum to what the
// renter pre-authorised, whatever order events arrive in.

export const DEPOSIT_RATE = 0.15;
export const GEOFENCE_M = 500; // D-01
export const GEOFENCE_GRACE_S = 60; // D-01 T_grace
export const HOUR_TAMPER = 0.1; // D-02
export const OVERUSE_TOLERANCE = 0.1; // D-03
export const MIN_PHOTOS = 3; // P1
export const PHOTO_RADIUS_M = 500; // P1

export type Stage =
  "PRE_AUTH" | "HANDOVER" | "ACTIVE" | "RETURN_AUDIT" | "DISPUTE_OPEN" | "SETTLED" | "CANCELLED";
export type Rule = "D-01" | "D-02" | "D-03" | "D-04" | "D-05" | "D-06" | "D-07";

export interface Ledger {
  escrow: number;
  owner: number;
  platform: number;
  renterRefund: number;
}

export interface EscrowState {
  stage: Stage;
  hourlyRatePaise: number;
  contractedHours: number;
  takeRate: number;
  basePaise: number;
  depositPaise: number;
  renterPaidPaise: number;
  ledger: Ledger;
  h0: number | null;
  hFinal: number | null;
  depositFrozen: boolean;
  ruleFired: Rule | null;
  error: string | null;
}

export type EscrowEvent =
  | { type: "AUTHORIZE" }
  | {
      type: "HANDOVER";
      photos: number;
      photosWithinM: number;
      h0: number;
      ownerOtp: boolean;
      renterOtp: boolean;
      kycOk: boolean;
    }
  | { type: "NO_SHOW" }
  | {
      type: "TELEMETRY";
      distanceOutsideM: number;
      secondsOutside: number;
      ecuHours: number;
      gpsHours: number;
    }
  | { type: "RETURN"; hFinal: number; fuelOk: boolean; damageOk: boolean }
  | { type: "SETTLE" }
  | { type: "RESOLVE"; ruling: "renter_at_fault" | "owner_at_fault" };

export const totalPaise = (l: Ledger) => l.escrow + l.owner + l.platform + l.renterRefund;

/** depositFloorInr: the HP-tier floor (contract §5); the deposit is max(15 % of rental, floor). */
export function createEscrow(t: {
  hourlyRateInr: number;
  contractedHours: number;
  takeRate: number;
  depositFloorInr?: number;
}): EscrowState {
  if (!(Number.isFinite(t.hourlyRateInr) && t.hourlyRateInr > 0))
    throw new RangeError("hourlyRateInr must be > 0");
  if (!(Number.isInteger(t.contractedHours) && t.contractedHours > 0))
    throw new RangeError("contractedHours must be a positive integer");
  if (!(t.takeRate >= 0.12 && t.takeRate <= 0.15)) throw new RangeError("takeRate must be within 12-15 %");
  const floor = t.depositFloorInr ?? 0;
  if (!(Number.isFinite(floor) && floor >= 0))
    throw new RangeError("depositFloorInr must be a finite amount ≥ 0");
  const hourlyRatePaise = Math.round(t.hourlyRateInr * 100);
  const basePaise = hourlyRatePaise * t.contractedHours;
  const depositPaise = Math.max(Math.round(basePaise * DEPOSIT_RATE), Math.round(floor * 100));
  const held = basePaise + depositPaise;
  return {
    stage: "PRE_AUTH",
    hourlyRatePaise,
    contractedHours: t.contractedHours,
    takeRate: t.takeRate,
    basePaise,
    depositPaise,
    renterPaidPaise: held,
    ledger: { escrow: held, owner: 0, platform: 0, renterRefund: 0 },
    h0: null,
    hFinal: null,
    depositFrozen: false,
    ruleFired: null,
    error: null,
  };
}

const finite = (...xs: number[]) => xs.every((x) => Number.isFinite(x) && x >= 0);
const reject = (s: EscrowState, error: string): EscrowState => ({ ...s, error });

// Pay `chargePaise` out of escrow: owner gets it net of take-rate, platform the
// take, the renter everything left in escrow.
function payout(
  s: EscrowState,
  chargePaise: number,
  stage: Stage,
  rule: Rule | null = s.ruleFired,
): EscrowState {
  const charge = Math.min(chargePaise, s.ledger.escrow);
  const owner = Math.round(charge * (1 - s.takeRate));
  return {
    ...s,
    stage,
    ruleFired: rule,
    error: null,
    ledger: { escrow: 0, owner, platform: charge - owner, renterRefund: s.ledger.escrow - charge },
  };
}

const dispute = (s: EscrowState, rule: Rule, extra: Partial<EscrowState> = {}): EscrowState => ({
  ...s,
  ...extra,
  stage: "DISPUTE_OPEN",
  ruleFired: rule,
  error: null,
});

export function escrowReducer(s: EscrowState, e: EscrowEvent): EscrowState {
  if (s.stage === "SETTLED" || s.stage === "CANCELLED") return s; // terminal: replays are no-ops

  switch (e.type) {
    case "AUTHORIZE":
      return s.stage === "PRE_AUTH"
        ? { ...s, stage: "HANDOVER", error: null }
        : reject(s, "already authorised");

    case "NO_SHOW":
      return s.stage === "HANDOVER"
        ? payout(s, 0, "CANCELLED", "D-06")
        : reject(s, "no-show only applies before handover");

    case "HANDOVER": {
      if (s.stage !== "HANDOVER") return reject(s, "handover only after authorisation");
      if (!e.kycOk) return payout(s, 0, "CANCELLED", "D-07");
      if (!finite(e.h0, e.photos, e.photosWithinM)) return reject(s, "invalid handover data");
      if (e.photos < MIN_PHOTOS) return reject(s, `need ≥ ${MIN_PHOTOS} condition photos`);
      if (e.photosWithinM > PHOTO_RADIUS_M)
        return reject(s, "photos must be geotagged within 500 m of the lot");
      if (!e.ownerOtp || !e.renterOtp) return reject(s, "both parties must confirm the OTP");
      return { ...s, stage: "ACTIVE", h0: e.h0, error: null };
    }

    case "TELEMETRY": {
      if (s.stage !== "ACTIVE") return reject(s, "telemetry only during the active window");
      if (!finite(e.distanceOutsideM, e.secondsOutside, e.ecuHours, e.gpsHours))
        return reject(s, "invalid telemetry frame");
      if (e.distanceOutsideM > GEOFENCE_M && e.secondsOutside >= GEOFENCE_GRACE_S) {
        return dispute(s, "D-01", { depositFrozen: true });
      }
      if (e.gpsHours > 0 && Math.abs(e.ecuHours - e.gpsHours) / e.gpsHours > HOUR_TAMPER + 1e-9)
        return dispute(s, "D-02");
      return { ...s, error: null };
    }

    case "RETURN": {
      if (s.stage !== "ACTIVE" || s.h0 === null) return reject(s, "return only during the active window");
      if (!finite(e.hFinal)) return reject(s, "invalid hour-meter reading");
      if (e.hFinal < s.h0) return dispute(s, "D-02", { hFinal: e.hFinal }); // meter rolled back
      if (!e.fuelOk) return dispute(s, "D-04", { hFinal: e.hFinal });
      if (!e.damageOk) return dispute(s, "D-05", { hFinal: e.hFinal });
      return { ...s, stage: "RETURN_AUDIT", hFinal: e.hFinal, error: null };
    }

    case "SETTLE": {
      if (s.stage !== "RETURN_AUDIT" || s.h0 === null || s.hFinal === null)
        return reject(s, "nothing to settle");
      const dH = s.hFinal - s.h0;
      const billedHours = Math.min(dH, s.contractedHours);
      let charge = Math.round(billedHours * s.hourlyRatePaise);
      let rule: Rule | null = null;
      if (dH > s.contractedHours * (1 + OVERUSE_TOLERANCE)) {
        charge += Math.round((dH - s.contractedHours) * s.hourlyRatePaise); // capped at escrow in payout
        rule = "D-03";
      }
      return payout(s, charge, "SETTLED", rule);
    }

    case "RESOLVE": {
      if (s.stage !== "DISPUTE_OPEN") return reject(s, "no open dispute");
      if (e.ruling === "owner_at_fault") return payout(s, 0, "SETTLED");
      // Renter at fault: base rental billed as usual, deposit forfeited to the owner in full.
      const settled = payout(
        { ...s, ledger: { ...s.ledger, escrow: s.ledger.escrow - s.depositPaise } },
        s.basePaise,
        "SETTLED",
      );
      return { ...settled, ledger: { ...settled.ledger, owner: settled.ledger.owner + s.depositPaise } };
    }
  }
}
