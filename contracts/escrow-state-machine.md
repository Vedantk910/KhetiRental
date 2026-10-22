# 3-Stage Milestone Escrow Protocol

> **Owner: Lead 2 (Product & Risk Architecture).** This is a product/risk
> contract, not an implementation spec. Lead 1 builds the state machine in
> `services/booking-orchestrator/`; Lead 2 owns the state definitions,
> gate criteria, and the dispute-detection rules in this file.
>
> The protocol converts a marketplace "promise" into a **conditional escrow**:
> funds are held, and release is gated on verifiable milestones backed by
> telematics. This is the risk spine of KhetiRental — it replaces informal
> broker trust with machine-verifiable proof of condition, use, and return.

---

## 1. Design rationale (Amazon INVEST lens)

The escrow exists to resolve the two-sided market's core asymmetry:

- **Renter (farmer)** risk: pays upfront, receives a machine that may be
  broken, absent, or under-used.
- **Lister (owner)** risk: hands over an asset that may be damaged,
  mis-fuelled, driven off-parcel, or not returned.

A **single milestone-gated hold** lets both parties recover capital only
when the *other side's* obligation is verified by telemetry. The deposit is
a **collateral** that freezes on breach (geofence), so the platform is not
the party of last resort.

Three milestones split the rental journey into independently verifiable
stages:

| Stage | Trigger | Verified by |
|---|---|---|
| **Pre-Dispatch Inspection** | before machine leaves the owner's lot | geotagged photos, CAN-bus engine-hour meter lock, 2FA handover |
| **Telematics Active Window** | machine in use on the parcel | GPS geofence (5 km radius), continuous engine run-hour log |
| **Post-Return Audit** | machine returned to owner | Δ engine-hours, fuel-level check, damage audit |

Each stage's gate is **automated where telemetry allows**, and **human +
evidence where it doesn't** (damage photos). The state machine below is the
single source of truth both the product and the Go implementation use.

---

## 2. State machine

```
                        ┌──────────────────────────────────────────────┐
                        │                                              │
                        ▼                                              │
  (booking)  HOLD ────────────────────────────────────────────────────────
   Pre-Authorization: 100% rental + 15% security deposit locked.
                        │
                        │  machine arrives on parcel; owner + renter
                        │  both confirm via 2FA; geotagged photos;
                        │  CAN-bus engine-hour meter locked (baseline H0)
                        ▼
              PRE_DISPATCH_INSPECTION ──gate→  (gate P1)
                        │
                        │  machine crosses geofence into active window;
                        │  GPS + run-hour logging begins
                        ▼
                    ACTIVE (TELEMATICS_WINDOW)
                        │
                        │  continuous monitoring:
                        │   • geofence breach > 500 m  → FREEZE_DEPOSIT
                        │   • hour-tamper > 10 %        → FLAG_DISPUTE
                        ▼
                 POST_RETURN_AUDIT ──gate→  (gate P2)
                        │
                        │  ΔH = H_final − H0 ; fuel check ; damage audit
                        ▼
                   SETTLEMENT
                        │
                        │  base rental → owner ; platform take-rate
                        │  deducted ; deposit released (or frozen→offset)
                        ▼
                      DONE

  Any stage may branch to a DISPUTE state on gate failure or breach:
        P1 fail / P2 fail / geofence freeze / hour-tamper flag
                        │
                        ▼
                  DISPUTE_OPEN ── (auto-resolution or human)
                        │
                        ▼
              RESOLVED_SETTLE / DEPOSIT_FORFEIT / RELEASE_COMPENSATION
```

### State definitions

| State | Entry condition | Exit condition | Invariants |
|---|---|---|---|
| `HOLD` | booking confirmed, pre-auth captured | P1 passed | deposit = 115 % of base rental; no telemetry yet |
| `PRE_DISPATCH_INSPECTION` | P1 in progress | P1 passed → `ACTIVE` | H0 baseline recorded & locked; 2FA from both parties |
| `ACTIVE` | P1 passed, machine in geofence | P2 entry | geofence + run-hour logging live; breach → freeze |
| `POST_RETURN_AUDIT` | machine returned, P2 in progress | P2 passed → `SETTLEMENT` | ΔH computed; fuel + damage evidence attached |
| `SETTLEMENT` | P2 passed | payment split executed | take-rate 12–15 %; deposit disposition final |
| `DISPUTE_OPEN` | any gate fail / breach | resolution | evidence frozen, no settlement until resolved |

### Gate definitions

- **P1 (Pre-Dispatch gate, 4 checks):**
  1. Geotagged condition photo ≥ 3, within 500 m of registered lot.
  2. CAN-bus engine-hour meter read **and locked** at H0 (prevents reset).
  3. 2FA handover: owner + renter both authenticate (OTP + app).
  4. RC/KYC asset identity verified (Vahan + Aadhaar cross-check).
- **P2 (Post-Return gate, 3 checks):**
  1. ΔH = H_final − H0 within [contracted_min, contracted_max] ± tolerance.
  2. Fuel-level delta vs logged start within acceptable loss band.
  3. Damage audit (photos + optional third-party) matches pre-dispatch baseline.

---

## 3. Automated dispute-detection rules (telematics-driven)

Each rule is a predicate the orchestrator evaluates on the live telemetry
stream (ingested from `services/telemetry-gateway`, stored in TimescaleDB).
Rules are **deterministic and evidence-logged** so a dispute can be replayed.

| ID | Rule | Trigger | Action |
|---|---|---|---|
| D-01 | **Geofence breach** | machine > 500 m outside registered parcel for ≥ `T_grace` (default 60 s) | `FREEZE_DEPOSIT`; raise `DISPUTE_OPEN`; notify renter |
| D-02 | **Hour tampering** | \|H_ecu − H_gps_implied\| / H_gps_implied > 10 % | `FLAG_DISPUTE`; hold settlement; request re-inspection |
| D-03 | **Over-use (ΔH high)** | ΔH > contracted_max + 10 % | `OFFSET_DEPOSIT` (charge renter for excess hours at hourly rate) |
| D-04 | **Fuel under-report** | fuel delta > loss band + 5 % | `DISPUTE_OPEN` (fuel-theft flag) |
| D-05 | **Damage mismatch** | post-return damage audit ≠ pre-dispatch baseline | `DISPUTE_OPEN`; withhold settlement until resolution |
| D-06 | **No-show / non-activation** | no GPS entry within 24 h of dispatch | `AUTO_REFUND` deposit to renter; cancel |
| D-07 | **Identity/KYC mismatch** | asset RC not matched to listed owner | `BLOCK_LISTING`; manual review |

> **T_grace** exists so a single GPS drift (common on 2G) doesn't trigger a
> false geofence breach — the breach must persist for the grace window.

---

## 4. Deposit disposition matrix

| Outcome | Base rental | Security deposit (15 %) |
|---|---|---|
| Clean return, all gates pass | → owner (after take-rate) | → refund to renter |
| D-01 geofence breach confirmed | → owner | → forfeit to owner (damage risk) |
| D-03 over-use | owner + excess-hour charge to renter | partially offset |
| D-05 damage | owner | offset to repair estimate, balance refunded |
| D-06 no-show | none | full refund to renter |

The **platform take-rate** (12–15 % of GMV) is deducted at settlement from
the owner's share, recorded in `analytics` for KPI/LTV tracking (see
`analytics/kpis.py`).

---

## 5. Contract / event boundary (for Lead 1)

Lead 1 implements this in `services/booking-orchestrator` as a saga. The
state enum and gate predicates in this file are the **contract**; the Go
types in `contracts/schemas/` (machine, booking, telemetry) are the shared
data model. Lead 2 owns the rule thresholds; Lead 1 owns the enforcement
mechanics. Any change to a gate threshold or state is a Lead 2 change,
reviewed via ADR.
