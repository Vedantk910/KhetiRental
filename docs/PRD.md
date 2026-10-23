# KhetiRental v2.0 — Product Requirements Document

- **Owner:** Lead 2 (Product & Risk Architecture) · **Status:** Draft v2.0 · **Updated:** 2026-10-24
- **Implements against:** [`contracts/openapi.yaml`](../contracts/openapi.yaml), [`contracts/escrow-state-machine.md`](../contracts/escrow-state-machine.md)
- **Decisions:** [ADR-0001](adr/0001-h3-vs-postgis.md) · [ADR-0002](adr/0002-kafka-saga-vs-2pc.md) · [ADR-0003](adr/0003-3-stage-escrow.md) · [ADR-0004](adr/0004-dynamic-depreciation-pricing.md)
- **Provenance:** academic prototype (Sept 2023; shortlisted, Internal Smart India Hackathon 2024, AISSMS COE) → v2.0 production architecture ([`ARCHITECTURE.md`](../ARCHITECTURE.md)).

Every figure below is tagged **[measured]** (produced by code in this repo), **[source]** (public data), or **[assumption]** (to validate in pilot).

---

## 1. Executive Summary

Small farmers in India need a tractor for a few hours, a few times a year, inside a short sowing or harvest window. They mostly rent through informal brokers who set the price, give no guarantee on condition, and leave no record when something goes wrong. Owners, for their part, leave expensive machines idle most of the year because renting to strangers is risky.

KhetiRental is a two-sided marketplace that matches a farmer to a nearby machine in milliseconds, holds the money in a **3-stage milestone escrow** that only releases when telematics prove the machine was delivered, used on the right parcel and returned, and prices each machine-hour from its real cost drivers rather than a broker's markup.

### Core problem

| Fact | Value | Tag |
|---|---|---|
| Holdings that are small or marginal (< 2 ha) | ~86 % | [source] Agriculture Census 2015-16 |
| Informal broker markup over a fair hourly rate | ~38 % | [assumption] — validate with district price survey in pilot |
| Effective harvest / sowing window per crop cycle | ~12 days | [assumption] — varies by crop and district |
| Idle tractor utilisation today | ~250 h / year | [assumption] |

### What v2.0 delivers

1. **Sub-10 ms matching** at harvest-surge load: H3 Res-8 k-ring search, p95 **0.66 ms**, p99 **2.91 ms**, 0 % errors at 5,000 VUs [measured, single host — see `ARCHITECTURE.md`].
2. **Milestone escrow**: 100 % rental + 15 % security deposit pre-authorised; release gated on P1 (pre-dispatch) and P2 (post-return) checks plus automated dispute rules D-01..D-07.
3. **Transparent pricing**: `R = B·μ_season·δ_soil + D_wear·κ_age + F·P_diesel` ([`analytics/pricing.py`](../analytics/pricing.py)).
4. **Offline-first field sync**: CRDT telemetry that survives 2G drops and replays.

---

## 2. User Personas

| | **Renter — marginal farmer** | **Lister — tractor owner / Custom Hiring Centre (CHC)** |
|---|---|---|
| Profile | 1–2 ha, 1–2 crops/yr, feature phone or low-end Android, 2G/3G | Owns 1–10 tractors (35–75 HP), often a CHC under a state scheme |
| Job to be done | "Get a 45 HP tractor on my field inside the window, at a fair price" | "Keep my machines earning without losing them or arguing over hours" |
| Today's pain | Broker markup, no-shows, no recourse for a broken machine | Idle months, off-parcel misuse, meter tampering, slow disputes |
| Must-haves | Vernacular UI, works offline, pay only for verified hours | Deposit protection, verified hours, fast settlement |
| Trust signal | Machine photos at handover + refund on no-show (D-06) | Geofence freeze (D-01), hour-tamper flag (D-02) |

---

## 3. 6-Stage User Journey

| # | Stage | Renter sees | Lister sees | System of record | Exit criterion |
|---|---|---|---|---|---|
| 1 | **Search** | Ranked machines within radius, price per hour | — | matching-engine (`GET /machines/near`) | Renter picks a machine |
| 2 | **Escrow pre-auth** | Pre-auth of rental + 15 % deposit | Booking request | booking-orchestrator saga → `ESCROW_AUTHORIZED` | Auth within 30 s SLA, else compensate → `FAILED_PAYMENT_RELEASED` |
| 3 | **Dispatch** (gate P1) | Handover OTP, photos | Photos ≥ 3, engine-hour meter H0 locked, 2FA | escrow `PRE_DISPATCH_INSPECTION` | All 4 P1 checks pass |
| 4 | **Telematics active window** | Live hours used | Live location + hours | telemetry-gateway (CRDT) → TimescaleDB | Machine returned |
| 5 | **Inspection** (gate P2) | ΔH, fuel, damage summary | Same, plus dispute option | escrow `POST_RETURN_AUDIT` | ΔH, fuel, damage within tolerance |
| 6 | **Settlement** | Deposit refund | Payout minus take-rate | escrow `SETTLEMENT` | Funds split executed |

Failure branches from any stage go to `DISPUTE_OPEN` per the escrow contract.

---

## 4. Functional Requirements

| ID | Requirement | Contract / code |
|---|---|---|
| FR-1 | Search returns at most `limit` (default 20, max 100) machines ranked by distance decay, HP match and owner reputation, trimmed to `radius_km` | `openapi.yaml#/paths/~1machines~1near`, `services/matching-engine` |
| FR-2 | Every mutating call carries an `Idempotency-Key`; a replay never creates a second booking | `openapi.yaml` `IdempotencyKey`; `deploy/sql/001_bookings.sql` UNIQUE |
| FR-3 | A machine can be held by only one booking at a time, even under concurrent requests | Redlock + fencing (`internal/redlock`) |
| FR-4 | Payment auth that fails or exceeds 30 s releases the inventory hold and ends in `FAILED_PAYMENT_RELEASED` | `internal/saga` |
| FR-5 | Every state change emits its event via the transactional outbox (no dual write) | ADR-0002, `deploy/sql/002_outbox_inbox.sql` |
| FR-6 | Field devices sync telemetry over WebSocket; replayed frames are idempotent | `services/telemetry-gateway` |
| FR-7 | Dispute rules D-01..D-07 evaluate automatically on telemetry | `contracts/escrow-state-machine.md` §3 |
| FR-8 | Hourly price is itemised (base, wear, fuel) and shown to both sides | `analytics/pricing.py` |

### Non-functional

| NFR | Target | Status |
|---|---|---|
| Search latency | p95 < 10 ms, p99 < 25 ms at 5,000 VUs | Met on single host [measured] |
| Search error rate | < 0.1 % | 0.00 % [measured] |
| Escrow auth SLA | 30 s, then compensate | Unit-tested |
| Offline tolerance | Any frame order / replay converges | CRDT unit + WS integration tests |

---

## 5. Escrow & Dispute Rules (summary)

Full specification: [`contracts/escrow-state-machine.md`](../contracts/escrow-state-machine.md).

| Rule | Trigger | Action |
|---|---|---|
| D-01 Geofence breach | > 500 m outside parcel for ≥ 60 s | Freeze deposit, open dispute |
| D-02 Hour tampering | ECU vs GPS-implied hours differ > 10 % | Flag, hold settlement |
| D-03 Over-use | ΔH > contracted max + 10 % | Charge excess from deposit |
| D-04 Fuel under-report | Fuel delta > loss band + 5 % | Open dispute |
| D-05 Damage mismatch | Post-return audit ≠ pre-dispatch baseline | Withhold settlement |
| D-06 No-show | No GPS entry within 24 h of dispatch | Auto-refund renter |
| D-07 KYC mismatch | RC not matched to listed owner | Block listing |

---

## 6. Edge Case Taxonomy

| Class | Scenario | Required behaviour | Covered by | Gap |
|---|---|---|---|---|
| **2G offline dropout** | Device loses signal mid-window, reconnects hours later and replays frames | Server converges; no double-count of hours; late old frames never overwrite newer data | CRDT LWW merge + WS replay test; `telemetry_points` PK dedup | — |
| | Single GPS jump > 500 m from drift | No false breach | D-01 grace window (60 s) | Grace not yet implemented in `internal/geo` |
| **Mid-lease breakdown** | Machine fails after P1, before planned return | Renter pays only verified ΔH; owner bears repair; renter offered nearest replacement | — | **No dispute rule** — define D-08 |
| **Weather delay** | Rain blocks fieldwork after dispatch | Pause billing clock; extend window without penalty to either side | — | **No rule** — define pause/extend policy |
| **Dispute escalation** | Auto-rule fires but a party contests | Evidence frozen, human review, SLA for resolution | `DISPUTE_OPEN` state | Resolution SLA and reviewer roles undefined |
| **Payment timeout** | Provider slower than 30 s, then approves late | Inventory released and authorisation voided | Saga compensation releases inventory | Escrow authorisation not voided on timeout |
| **Concurrent booking** | Two renters book the same machine in the same second | Exactly one wins | Redlock + fencing | Fencing check at DB layer to be verified |

The gaps above are the input to the v2.0 risk audit (prompt 3).

---

## 7. Pricing & Unit Economics

From [`analytics/results/pricing_report.json`](../analytics/results/pricing_report.json) [measured, diesel 91 INR/L]:

| Machine | Profile | Hourly rate (INR) | of which fuel pass-through |
|---|---|---|---|
| M-101 | 45 HP, 5 yr, loam, harvest surge | 1,053.00 | 364.00 |
| M-102 | 75 HP 4WD, 9 yr, black-cotton, harvest surge | 2,372.95 | 709.80 |
| M-103 | 55 HP, 11 yr, sandy, sowing | 1,186.70 | 473.20 |
| M-104 | 35 HP, 2 yr, loam, off-season | 634.10 | 291.20 |

**Utilisation expansion (M-101, acquisition 6.4 L INR):** net to owner = (rate − fuel) × (1 − 13.5 % take-rate) = **596 INR/h**. Payback falls from **4.3 years at 250 h/yr to 1.73 years at 620 h/yr** [measured]. This is before operator wages, maintenance and insurance, so real payback is longer; add those to the model before quoting externally.

Take-rate: 12–15 % of GMV, deducted from the owner's share at settlement.

---

## 8. Success Metrics

Formulas live in [`analytics/kpis.py`](../analytics/kpis.py).

| KPI | Formula | Pilot target [assumption] |
|---|---|---|
| Liquidity Index (per H3-7 district) | `min(supply, demand)/max(supply, demand) × 1/p95_wait` | ≥ 0.25 in pilot districts |
| Time-to-Fulfill | median(t_confirmed − t_search) | ≤ 30 min |
| Equipment Utilisation Rate | billed_hours / (active_days × 24) | 250 → 620 h/yr per machine |
| Dispute rate | disputes / settled bookings | < 5 % |
| Escrow auto-resolution | disputes closed by rules D-01..D-07 without human review | ≥ 70 % |

---

## 9. Out of Scope (v2.0)

API gateway and dedicated escrow service (planned containers), real payment-provider and Vahan/Aadhaar integrations, mobile app UI, Kafka client wiring (saga produces through an interface today).

---

## 10. Open Questions

1. Validate the 38 % broker markup and 12-day window with a district price survey before external use.
2. Mid-lease breakdown (D-08) and weather-delay policies: who bears the cost, and what evidence triggers them?
3. Dispute resolution SLA and reviewer role (platform ops vs. third-party agronomist).
4. Deposit size: is a flat 15 % right for a 75 HP 4WD vs. a 35 HP machine, or should it scale with asset value?
5. Include owner opex (operator, maintenance, insurance) in the payback model.
