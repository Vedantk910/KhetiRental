# 3-Stage Milestone Escrow Protocol

> This is a product/risk contract, not an implementation spec. The state
> machine is built in `showcase/go/booking-orchestrator/`; this file owns the
> state definitions,
> gate criteria, deposit policy and the dispute-detection rules in this file.
>
> The protocol converts a marketplace "promise" into a **conditional escrow**:
> funds are held, and release is gated on verifiable milestones backed by
> telematics. It replaces informal broker trust with machine-verifiable proof
> of condition, use, and return.
>
> **v2.0 revision (2026-10-24):** resolves the contract defects found in
> [`showcase/docs/audit/phase1-invariant-audit.md`](../docs/audit/phase1-invariant-audit.md)
> (remediations 13–22): one deposit definition, one geofence definition,
> representable dispute states, GPS-spoof and meter-rollback rules, a 2G-safe
> no-show rule, listing-time KYC, breakdown (D-08) and weather (D-09) rules,
> a dispute SLA and an HP-tier deposit floor.

---

## 1. Design rationale (Amazon INVEST lens)

The escrow exists to resolve the two-sided market's core asymmetry:

- **Renter (farmer)** risk: pays upfront, receives a machine that may be
  broken, absent, or under-used.
- **Lister (owner)** risk: hands over an asset that may be damaged,
  mis-fuelled, driven off-parcel, or not returned.

A **single milestone-gated hold** lets both parties recover capital only
when the *other side's* obligation is verified by telemetry. The security
deposit is **collateral** that freezes on breach, so the platform is not
the party of last resort.

Three milestones split the rental journey into independently verifiable
stages:

| Stage | Trigger | Verified by |
|---|---|---|
| **Pre-Dispatch Inspection** | before the machine leaves the owner's lot | geotagged photos, CAN-bus engine-hour meter lock, 2FA handover, number-plate vs RC photo |
| **Telematics Active Window** | machine in use on the parcel | GPS geofence (500 m beyond the registered parcel edge, D-01), continuous engine run-hour log |
| **Post-Return Audit** | machine returned to owner | Δ engine-hours, fuel-level check, damage audit |

Each stage's gate is **automated where telemetry allows**, and **human +
evidence where it doesn't** (damage photos). The state machine below is the
single source of truth for the product and the Go implementation.

---

## 2. Money definitions

| Term | Definition |
|---|---|
| Base rental | hourly rate (`showcase/analytics/pricing.py`) × contracted hours |
| Security deposit | `max(15 % of base rental, HP-tier floor)` — see §5 |
| Pre-authorisation | base rental + security deposit, held at booking (for a 15 % deposit this is 115 % of base rental) |
| Take-rate | 12–15 % of the billed amount, deducted from the owner's share at settlement |
| Billed amount | verified ΔH (capped at contracted hours) × hourly rate, plus any D-03 excess |

Money is held and moved in integer paise. At every instant
`held + owner payout + platform take + renter refund = pre-authorisation`.

---

## 3. State machine

```
  (booking)  HOLD
   Pre-authorisation: base rental + security deposit locked.
                        │
                        │  machine arrives on parcel; owner + renter
                        │  both confirm via 2FA; geotagged photos;
                        │  CAN-bus engine-hour meter locked (baseline H0)
                        ▼
              PRE_DISPATCH_INSPECTION ──gate→  (gate P1)
                        │
                        │  machine on the parcel; GPS + run-hour logging begins
                        ▼
                    ACTIVE (TELEMATICS_WINDOW) ◄──── PAUSED_WEATHER (D-09)
                        │                    └────► SUSPENDED_BREAKDOWN (D-08)
                        │  continuous monitoring:
                        │   • > 500 m beyond parcel edge for ≥ 60 s → FREEZE_DEPOSIT (D-01)
                        │   • implausible GPS track                  → FLAG_DISPUTE (D-01b)
                        │   • hour divergence > 10 % or rollback     → FLAG_DISPUTE (D-02)
                        ▼
                 POST_RETURN_AUDIT ──gate→  (gate P2)
                        │
                        │  ΔH = H_final − H0 ; fuel check ; damage audit
                        ▼
                   SETTLEMENT
                        │
                        │  billed amount → owner (minus take-rate);
                        │  deposit released, or frozen → offset
                        ▼
                      DONE

  Any stage may branch to DISPUTE_OPEN on gate failure or breach:
        P1 fail / P2 fail / geofence freeze / hour-tamper flag / spoof flag
                        │
                        ▼
                  DISPUTE_OPEN ── auto-resolution (D-01/03/04) or ops review, ≤ 72 h
                        │
                        ▼
              RESOLVED_SETTLE / DEPOSIT_FORFEIT / RELEASE_COMPENSATION
```

### State definitions

| State | Entry condition | Exit condition | Invariants |
|---|---|---|---|
| `HOLD` | booking confirmed, pre-auth captured | P1 passed, D-06 no-show, or P1 plate mismatch | pre-auth = base rental + security deposit; no telemetry yet |
| `NO_SHOW_PENDING` | 24 h after dispatch with no device sync at all (D-06) | first sync → re-evaluate D-06; 72 h → manual review | no refund while pending |
| `PRE_DISPATCH_INSPECTION` | P1 in progress | P1 passed → `ACTIVE` | H0 baseline recorded and locked; 2FA from both parties |
| `ACTIVE` | P1 passed, machine on parcel | return → P2; D-08 → `SUSPENDED_BREAKDOWN`; D-09 → `PAUSED_WEATHER` | geofence + run-hour logging live; breach → freeze |
| `PAUSED_WEATHER` | D-09 trigger | rain alert cleared or 48 h cap | billing clock stopped; window extended by paused time |
| `SUSPENDED_BREAKDOWN` | D-08 trigger | replacement accepted, or settle at verified ΔH | billing stopped at the last verified engine hour |
| `POST_RETURN_AUDIT` | machine returned, P2 in progress | P2 passed → `SETTLEMENT` | ΔH computed; fuel + damage evidence attached |
| `SETTLEMENT` | P2 passed | payment split executed | take-rate 12–15 %; deposit disposition final |
| `DISPUTE_OPEN` | any gate fail, breach or flag | resolution, ≤ 72 h | evidence frozen; no settlement until resolved |

### Booking-state mapping (API and database)

The booking saga exposes a coarser state set in `showcase/contracts/openapi.yaml`
and the `bookings` table. The escrow states map to it as follows:

| Escrow state | Booking state |
|---|---|
| `HOLD` | `ESCROW_AUTHORIZED` |
| `PRE_DISPATCH_INSPECTION` | `DISPATCHED` |
| `ACTIVE`, `PAUSED_WEATHER` | `TELEMATICS_ACTIVE` |
| `SUSPENDED_BREAKDOWN` | `SUSPENDED_BREAKDOWN` |
| `NO_SHOW_PENDING` | `NO_SHOW_PENDING` |
| `POST_RETURN_AUDIT` | `POST_RETURN_AUDIT` |
| `SETTLEMENT`, `DONE` | `SETTLED` |
| `DISPUTE_OPEN` | `DISPUTE_OPEN` |

`DISPUTE_OPEN` is entered only from `TELEMATICS_ACTIVE` or
`POST_RETURN_AUDIT` (or from `DISPATCHED` on a P1 failure).

### Gate definitions

- **Listing-time KYC (before any booking):** asset RC matched to the lister
  via Vahan and Aadhaar. A mismatch blocks the listing (D-07).
- **P1 (Pre-Dispatch gate, 4 checks):**
  1. Geotagged condition photos ≥ 3, within 500 m of the registered lot.
  2. CAN-bus engine-hour meter read **and locked** at H0 (prevents reset).
  3. 2FA handover: owner + renter both authenticate (OTP + app).
  4. Physical number plate matches the RC photo captured at listing.
- **P2 (Post-Return gate, 3 checks):**
  1. ΔH = H_final − H0 within [contracted_min, contracted_max] ± tolerance.
  2. Fuel-level delta vs logged start within acceptable loss band.
  3. Damage audit (photos + optional third-party) matches pre-dispatch baseline.

---

## 4. Automated dispute-detection rules (telematics-driven)

Each rule is a predicate the orchestrator evaluates on the telemetry track
(ingested by `showcase/go/telemetry-gateway`, stored per sample in TimescaleDB
`telemetry_points`). Rules are **deterministic and evidence-logged** so a
dispute can be replayed. Rules evaluate the stored track by device
timestamp, never only the last-known value, so a 2G blackout cannot hide an
excursion.

| ID | Rule | Trigger | Action |
|---|---|---|---|
| D-01 | **Geofence breach** | machine > 500 m outside registered parcel edge for ≥ `T_grace` (60 s) of consecutive samples | `FREEZE_DEPOSIT`; raise `DISPUTE_OPEN`; notify renter |
| D-01b | **GPS spoof** | implied speed between consecutive fixes > 40 km/h (proposed; confirm with field data), or an identical fix for ≥ 10 min while ECU hours advance | `FLAG_DISPUTE`; no freeze; request re-inspection |
| D-02 | **Hour tampering** | \|H_ecu − H_gps_implied\| / H_gps_implied > 10 % (exactly 10 % passes), **or** any ECU reading lower than the previous one; stationary PTO work (GPS travel = 0) is judged by fuel burn vs ECU hours instead | `FLAG_DISPUTE`; hold settlement; request re-inspection |
| D-03 | **Over-use (ΔH high)** | ΔH > contracted_max + 10 % | `OFFSET_DEPOSIT` (charge renter for excess hours at hourly rate) |
| D-04 | **Fuel under-report** | fuel delta > loss band + 5 % | `DISPUTE_OPEN` (fuel-theft flag) |
| D-05 | **Damage mismatch** | post-return damage audit ≠ pre-dispatch baseline | `DISPUTE_OPEN`; withhold settlement until resolution |
| D-06 | **No-show / non-activation** | 24 h after dispatch with **no** GPS fix inside the parcel, **no** ECU hour increment on the next sync, and **no** renter check-in OTP | `AUTO_REFUND` deposit + rental to renter; cancel. If the device has not synced since dispatch: `NO_SHOW_PENDING` (no refund) until first sync or 72 h, then manual review |
| D-07 | **Identity/KYC mismatch** | at listing: RC not matched to the lister; at P1: plate ≠ RC photo | at listing: `BLOCK_LISTING`; at P1: `RELEASE_COMPENSATION` (full renter refund + travel compensation charged to the lister) |
| D-08 | **Mid-lease breakdown** | after P1: ECU stops with a fault code, or renter report + photo confirmed by owner or ops | billing stops at the last verified ΔH; renter pays verified ΔH only; owner bears repair; nearest replacement offered via `/machines/near`; state `SUSPENDED_BREAKDOWN` |
| D-09 | **Weather pause** | IMD rainfall alert for the parcel's district during the window, plus zero ΔECU for ≥ 2 h | pause billing clock; extend window by the paused time, no penalty, capped at 48 h; after the cap either party may cancel pro-rata |

> **T_grace** exists so a single GPS drift (common on 2G) doesn't trigger a
> false geofence breach — the breach must persist for 60 s of samples.
> Distance is measured from the parcel **edge**, so working the headland of
> a field never trips D-01.

### Dispute resolution SLA

- Every `DISPUTE_OPEN` resolves within **72 h**.
- D-01, D-03 and D-04 auto-resolve when the evidence is complete (track,
  ΔH, fuel log).
- D-05 and any contested auto-resolution go to platform ops.
- Evidence is frozen at entry and replayable from `telemetry_points`.

---

## 5. Deposit policy and disposition

### Security deposit, calibrated by HP tier

A flat 15 % of rental under-collateralises large machines: for an 8-hour
sowing-season rental at the model rate, 15 % is ₹833 on a ₹3.9 L 35 HP
tractor but only ₹2,274 on a ₹17.2 L 75 HP 4WD. v2.0 keeps 15 % as the
default and adds a floor of 0.5 % of the asset's acquisition value:

`deposit = max(15 % × base rental, floor(HP tier))`

| HP tier | Reference asset value | 8 h sowing rental (model) | 15 % of rental | Tier floor (0.5 % of asset) | Deposit applied |
|---|---|---|---|---|---|
| 35 HP | ₹3,90,000 | ₹5,553 | ₹833 | ₹1,950 | ₹1,950 |
| 45 HP | ₹6,40,000 | ₹7,584 | ₹1,138 | ₹3,200 | ₹3,200 |
| 55 HP | ₹9,80,000 | ₹9,875 | ₹1,481 | ₹4,900 | ₹4,900 |
| 75 HP 4WD | ₹17,20,000 | ₹15,162 | ₹2,274 | ₹8,600 | ₹8,600 |

Rental figures come from `showcase/analytics/pricing.py` at diesel ₹91/L (loam,
sowing season). The 0.5 % floor is a pilot policy proposal, to be
calibrated against the first season's damage-claim data.

### Disposition matrix

| Outcome | Base rental | Security deposit |
|---|---|---|
| Clean return, all gates pass | billed amount → owner (after take-rate); unused hours refunded | → refund to renter |
| D-01 geofence breach confirmed | → owner | → forfeit to owner (damage risk) |
| D-03 over-use | owner + excess-hour charge to renter | offset by the excess, balance refunded |
| D-05 damage | owner | offset to repair estimate, balance refunded |
| D-06 no-show | none | full refund to renter |
| D-07 plate mismatch at P1 | none | full refund to renter; travel compensation charged to the lister |
| D-08 breakdown | verified ΔH only → owner | → refund to renter |
| D-09 weather, cancelled after cap | verified ΔH only → owner | → refund to renter |

The **platform take-rate** (12–15 % of GMV) is deducted at settlement from
the owner's share and recorded in `analytics` for KPI tracking
(see `showcase/analytics/kpis.py`).

---

## 6. Contract / event boundary

The booking orchestrator implements this in `showcase/go/booking-orchestrator` as a saga. The
state enum and gate predicates in this file are the **contract**; the
booking state set must stay identical across `showcase/contracts/openapi.yaml`, the
saga constants and the `bookings` CHECK (enforced by `docs/check_docs.py`).
This file sets the rule thresholds; the orchestrator enforces them. Any
change to a gate threshold or state is made here first and recorded in an ADR.
