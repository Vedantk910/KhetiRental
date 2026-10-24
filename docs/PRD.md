# KhetiRental v2.0 — Product Requirements Document

- **Owner:** Lead 2, Vedant Konde (Product & Risk Architecture) · **Status:** v2.0, approved for pilot build · **Updated:** 2026-10-24
- **Engineering counterpart:** Lead 1, Tarun Konde (Distributed Systems)
- **Implements against:** [`contracts/openapi.yaml`](../contracts/openapi.yaml), [`contracts/escrow-state-machine.md`](../contracts/escrow-state-machine.md), [`contracts/events/`](../contracts/events/booking.events.json)
- **Decisions:** [ADR-0001 H3 vs PostGIS](adr/0001-h3-vs-postgis.md) · [ADR-0002 Kafka saga vs 2PC](adr/0002-kafka-saga-vs-2pc.md) · [ADR-0003 3-stage escrow](adr/0003-3-stage-escrow.md) · [ADR-0004 Dynamic depreciation pricing](adr/0004-dynamic-depreciation-pricing.md)
- **Risk audit:** [`docs/audit/phase1-invariant-audit.md`](audit/phase1-invariant-audit.md) — its remediations are folded into §5, §7 and §10 of this document.
- **Provenance:** academic prototype (Sept 2023; shortlisted, Internal Smart India Hackathon 2024, AISSMS COE) → v2.0 production architecture ([`ARCHITECTURE.md`](../ARCHITECTURE.md)).

### How to read the numbers

Every figure carries a tag:

- **[measured]** — produced by code in this repository; the command to reproduce it is given.
- **[source]** — public data.
- **[model]** — output of `analytics/pricing.py` or `analytics/kpis.py` under stated inputs.
- **[assumption]** — a planning input not yet validated; each one has a validation plan in §12.

An earlier planning draft quoted "48 ms → 8.6 ms p99", "8.4 → 3.1-year payback" and "94 % dispute reduction". None of these were produced by this codebase, so this document does not use them.

---

## 1. Executive Summary & Problem Statement

### 1.1 The problem

India's farms are small and its tractors are idle. A farmer with one or two hectares needs a tractor for a few hours, several times a year, but always inside the same short sowing or harvest window as every neighbour. Buying one is out of reach; renting means going through an informal broker who sets the price, makes no promise about the machine's condition, and leaves no record when something goes wrong. On the other side, an owner or Custom Hiring Centre (CHC) watches an asset worth ₹4–17 lakh sit unused for most of the year, because renting to strangers carries real risk: the machine can be driven off-parcel, over-worked, returned damaged, or have its hour meter wound back.

| Fact | Value | Tag |
|---|---|---|
| Operational holdings that are small or marginal (< 2 ha) | ~86 % | [source] Agriculture Census 2015-16 |
| Informal broker markup over a fair hourly rate | ~38 % | [assumption] |
| Effective sowing / harvest window per crop cycle | ~12 days | [assumption] |
| Typical tractor utilisation today | ~250 h / year | [assumption] |
| Hours per year for a 5-year payback on a ₹6.4 L 45 HP tractor at harvest rates | 215 h | [model] |
| Hours per year for a 3-year payback on the same tractor | 358 h | [model] |

The last two rows matter. At 250 hours a year the owner of a 45 HP tractor recovers the purchase in roughly 4–5 years even at peak-season rates, and in about 5 years once the year is blended across seasons (§7.4). Each extra hour of rented utilisation compresses that, and the platform's job on the supply side is to fill idle hours safely.

### 1.2 What KhetiRental v2.0 is

A two-sided marketplace with three pieces of infrastructure that the informal market lacks:

1. **Fast, local matching.** A renter's location is converted to an Uber H3 hexagonal cell; nearby machines are found by expanding rings of cells, not by scanning every machine. Measured search latency at 5,000 concurrent virtual users: **p95 0.66 ms, p99 2.91 ms, 0.00 % errors, ~4,000 requests/s** [measured, single host; `tests/load/k6/full_flow.js`].
2. **A 3-stage milestone escrow.** The renter pre-authorises the rental plus a security deposit. Money moves only when each stage is verified: a photo-and-OTP handover with the engine-hour meter locked, a telematics window watched for geofence breaches and meter tampering, and a return audit of engine hours, fuel and damage. Nine dispute rules (D-01 to D-09) decide what happens when a stage fails.
3. **Transparent, cost-based pricing.** Every hourly rate is the sum of a market component, a depreciation-recovery component and a zero-margin diesel pass-through, shown to both parties line by line.

### 1.3 Goals for the pilot

| Goal | Metric | Target [assumption] |
|---|---|---|
| Farmers get a machine inside the window | Time-to-Fulfill (median) | ≤ 30 min |
| Owners earn from idle hours | Equipment utilisation | 250 → 400 h/yr in season one, 620 h/yr by year two |
| Trust replaces brokers | Dispute rate | < 5 % of settled bookings |
| Disputes resolve without people | Auto-resolution rate | ≥ 70 % of disputes |
| Payments never leak | Escrow ledger breaks | 0 (conservation is an invariant, §5.6) |

### 1.4 Non-goals for v2.0

Equipment financing, insurance underwriting, operator (driver) marketplace, implement-only rentals without a tractor, and cross-state logistics.

---

## 2. User Personas & Pain Points

### 2.1 Renter — the marginal farmer

> *Ramesh, 44, grows wheat and mustard on 1.6 ha near Chomu, Jaipur district. Keypad phone for calls, a shared Android for WhatsApp. Pays a broker in cash.*

| Dimension | Detail |
|---|---|
| Job to be done | "Get a 45 HP tractor with a rotavator on my field inside the 12 days before sowing, at a price I can check." |
| Pain points | Broker markup and price that rises as the window closes; no-shows on the promised day; a broken machine with no recourse; paying for hours that weren't worked |
| Constraints | 2G/3G coverage that drops in the field; low text literacy; cash-first; trusts people over apps |
| What changes his mind | Seeing the hourly rate itemised; paying only for engine hours actually used; an automatic refund if the machine never arrives |
| Design implications | Vernacular voice-first flows; OTP handover instead of signatures; offline-tolerant app (CRDT sync); UPI pre-authorisation, not card |

### 2.2 Lister — the tractor owner or Custom Hiring Centre

> *Sunita runs a CHC under a state mechanisation scheme with four tractors (35–75 HP) and implements. Two operators. Keeps a paper logbook.*

| Dimension | Detail |
|---|---|
| Job to be done | "Keep every machine earning in season without losing one, arguing over hours, or chasing payment." |
| Pain points | Idle months; machines taken to other fields; hour meters tampered; damage discovered late; slow cash collection |
| Constraints | Scheme reporting obligations; operator availability; diesel price swings |
| What changes her mind | A deposit that freezes automatically on a breach; engine hours read from the CAN bus, not from the renter; payout within a day of return |
| Design implications | Fleet dashboard; telematics device per machine; deposit floors by HP tier (§5.5); itemised payout statement |

### 2.3 Secondary actors

| Actor | Interest |
|---|---|
| Platform ops | Resolve disputes inside the 72 h SLA with replayable evidence |
| Payment provider | Idempotent pre-authorisation and void calls keyed by booking |
| State agriculture department | Utilisation reporting for subsidised CHC machines |

---

## 3. 6-Stage User Journey (Funnel)

| # | Stage | Renter sees | Lister sees | System of record | Exit criterion | Drop-off risk and mitigation |
|---|---|---|---|---|---|---|
| 1 | **Discovery** | Crop task, date window, farm size, location | — | client portal / app | Search submitted | Low literacy → icon-led crop picker, voice input |
| 2 | **H3 hexagonal proximity match** | Ranked machines with rate, distance, HP, owner rating | — | matching-engine `GET /machines/near` (H3 Res 8, k-ring 1–5) | Machine selected | Empty results in thin districts → widen ring, then show nearest district (Res 7) |
| 3 | **Escrow pre-authorisation** | Rental + deposit breakdown; one UPI approval | Booking request | booking-orchestrator saga → `ESCROW_AUTHORIZED` | Pre-auth within the 30 s SLA | Provider timeout → compensate: release machine and void the authorisation (FR-4) |
| 4 | **Stage 1 handover (P1)** | OTP, photos of the machine, hour meter reading | OTP, ≥ 3 geotagged photos, H0 locked | escrow `PRE_DISPATCH_INSPECTION` | All 4 P1 checks pass | No-show → D-06; plate mismatch → D-07 |
| 5 | **Stage 2 telematics window** | Hours used so far | Live location and hours | telemetry-gateway (CRDT sync) → `telemetry_points` | Machine returned | Off-parcel → D-01; spoofed GPS → D-01b; breakdown → D-08; rain → D-09 |
| 6 | **Stage 3 return audit (ΔH) & settlement** | ΔH, fuel and damage summary; refund | Same, plus payout statement | escrow `POST_RETURN_AUDIT` → `SETTLED` | Funds split executed | Contest → `DISPUTE_OPEN`, resolved ≤ 72 h |

Failure branches from any stage go to `DISPUTE_OPEN`, `NO_SHOW_PENDING` or `SUSPENDED_BREAKDOWN` per the escrow contract.

### 3.1 Funnel instrumentation

Every stage transition is an event on `booking.events` (via the transactional outbox), so the funnel is measured, not estimated: `search_submitted → candidate_selected → escrow_authorized → p1_passed → returned → settled`. Conversion between adjacent stages is reported per H3 Res-7 district.

---

## 4. Requirements

### 4.1 Functional requirements

| ID | Requirement | Contract / code | Status |
|---|---|---|---|
| FR-1 | Search returns at most `limit` (default 20, max 100) machines ranked by distance decay, HP match and owner reputation, trimmed to `radius_km` | `openapi.yaml` `/machines/near`; `services/matching-engine` | Built, tested |
| FR-2 | Every mutating call carries an `Idempotency-Key`; a replay never creates a second booking | `openapi.yaml` `IdempotencyKey`; `deploy/sql/001_bookings.sql` UNIQUE | Built, tested |
| FR-3 | A machine is held by at most one booking at a time, even under concurrent requests and paused processes | Redlock + database fencing (`internal/redlock`) | Built, tested (audit V1, V2, V5, V6, V11, V12 fixed) |
| FR-4 | A payment authorisation that fails or exceeds 30 s releases the machine **and voids the authorisation**; a late approval never moves the booking forward | `internal/saga` | Built, tested (audit V3, V4, V8 fixed) |
| FR-5 | Every state change and its event commit in one database transaction (no dual write) | ADR-0002; `internal/pgstore` | Built, tested (audit V7 fixed) |
| FR-6 | Field devices sync telemetry over WebSocket; replayed or reordered frames converge; the full track is retained | `services/telemetry-gateway` | Built, tested (audit V9 fixed; samples kept in memory until the TimescaleDB writer exists) |
| FR-7 | Dispute rules D-01..D-09 evaluate on the stored telemetry track by device timestamp | `contracts/escrow-state-machine.md` §4 | D-01 (edge + 60 s window) and D-02 built and tested; D-01b, D-08, D-09 specified |
| FR-8 | Hourly price is itemised (market, wear, diesel) and identical in every surface | `analytics/pricing.py`; `services/client-portal/lib/pricing-engine.ts` (golden-tested against the Python output) | Built, tested |
| FR-9 | The escrow ledger always balances: held + owner + platform + refund = pre-authorisation | `services/client-portal/lib/escrow-machine.ts` (property-tested over 2,000 random multi-actor sequences) | Built, tested |
| FR-10 | Listing requires RC ↔ owner verification before the machine can be booked | D-07 at listing | Specified |

### 4.2 Non-functional requirements

| NFR | Target | Status |
|---|---|---|
| Search latency | p95 < 10 ms, p99 < 25 ms at 5,000 VUs | Met: p95 0.66 ms, p99 2.91 ms [measured, single host] |
| Search error rate | < 0.1 % | Met: 0.00 % [measured] |
| Escrow auth SLA | 30 s, then compensate and void | Unit-tested, incl. late approvals |
| Offline tolerance | Any frame order or replay converges | CRDT unit tests + WebSocket integration tests |
| Concurrency safety | No double booking with 50 concurrent requesters | 50-goroutine race on real Redis: one holder at a time, 60/60 runs [measured] |
| Accessibility | WCAG 2.1 AA text contrast; keyboard operable; 375 px without horizontal scroll | Portal colour pairs 5.2–10:1 [measured]; e2e tests at 375/1024/1280/1440 px |

---

## 5. Risk & Escrow Governance

Full specification: [`contracts/escrow-state-machine.md`](../contracts/escrow-state-machine.md). This section states the policy and its reasoning.

### 5.1 Money definitions

| Term | Definition |
|---|---|
| Base rental | hourly rate × contracted hours |
| Security deposit | `max(15 % of base rental, HP-tier floor)` (§5.5) |
| Pre-authorisation | base rental + security deposit (115 % of base rental when the 15 % rate applies) |
| Billed amount | verified ΔH, capped at contracted hours, × hourly rate, plus any D-03 excess |
| Take-rate | 12–15 % of the billed amount, deducted from the owner's share |

### 5.2 Stages and gates

- **Listing-time KYC:** RC matched to the lister (Vahan + Aadhaar). Fraudulent listings are blocked before anyone pays.
- **Stage 1, P1 handover:** ≥ 3 geotagged photos within 500 m of the lot; CAN-bus hour meter read and locked as H0; OTP from both parties; number plate matches the RC photo.
- **Stage 2, telematics window:** geofence 500 m beyond the parcel edge with a 60 s grace; GPS-spoof checks; ECU-vs-GPS hour checks.
- **Stage 3, P2 return audit:** ΔH within tolerance; fuel within the loss band; damage audit matches the P1 baseline.

### 5.3 Dispute rules

| Rule | Trigger | Action | Resolution |
|---|---|---|---|
| D-01 Geofence breach | > 500 m beyond the parcel edge for ≥ 60 s of consecutive samples | Freeze deposit, open dispute | Auto, on complete track |
| D-01b GPS spoof | Implied speed > 40 km/h between fixes [assumption], or a frozen fix for ≥ 10 min while ECU hours advance | Flag, no freeze | Ops |
| D-02 Hour tampering | ECU vs GPS-implied hours differ by more than 10 % (exactly 10 % passes), or any ECU reading lower than the previous one | Flag, hold settlement | Ops |
| D-03 Over-use | ΔH > contracted + 10 % | Charge every excess hour from the deposit | Auto |
| D-04 Fuel under-report | Fuel delta > loss band + 5 % | Open dispute | Auto, on fuel log |
| D-05 Damage mismatch | Post-return audit ≠ P1 baseline | Withhold settlement | Ops |
| D-06 No-show | 24 h after dispatch with no fix inside the parcel, no ECU increment and no renter check-in | Full refund, cancel; if the device never synced: `NO_SHOW_PENDING` until first sync or 72 h | Auto / ops |
| D-07 KYC mismatch | At listing: RC ≠ lister. At P1: plate ≠ RC photo | Block listing; or full refund + travel compensation charged to lister | Auto |
| D-08 Mid-lease breakdown | ECU stops with a fault code, or renter report + photo confirmed | Stop billing at last verified ΔH; owner bears repair; offer nearest replacement | Auto |
| D-09 Weather pause | IMD rainfall alert for the district + zero ΔECU for ≥ 2 h | Pause billing, extend window up to 48 h; then pro-rata cancel | Auto |

All `DISPUTE_OPEN` cases resolve within **72 hours**, with evidence frozen at entry and replayable from `telemetry_points`.

### 5.4 Why each threshold

- **500 m beyond the edge, 60 s grace (D-01).** Measuring from the centroid would flag a tractor turning on the headland of a large field. The grace window absorbs single-fix GPS drift common on 2G, while a real trip to another field takes minutes.
- **10 % hour divergence (D-02).** ECU hours and GPS-implied hours drift apart naturally (idling, PTO work); 10 % leaves room for that without letting a meter wind-back of a full working day through on a typical 8–10 hour rental. Any backward ECU reading is tampering regardless of size, because meters only move forward.
- **+10 % over-use tolerance (D-03).** One extra hour on a 10-hour booking is normal overrun and not worth a charge; beyond that, every excess hour is billed so the deposit is not a free option on extra work.
- **72 h dispute SLA.** Long enough for ops to call both parties in a harvest week; short enough that the owner's money is not stuck past the window.

### 5.5 Security deposit calibrated by HP tier

A flat 15 % deposit under-collateralises large machines. For an 8-hour sowing-season rental at model rates (diesel ₹91/L, loam):

| HP tier | Reference asset value | 8 h rental [model] | 15 % of rental | Tier floor (0.5 % of asset) [assumption] | Deposit applied |
|---|---|---|---|---|---|
| 35 HP | ₹3,90,000 | ₹5,553 | ₹833 | ₹1,950 | ₹1,950 |
| 45 HP | ₹6,40,000 | ₹7,584 | ₹1,138 | ₹3,200 | ₹3,200 |
| 55 HP | ₹9,80,000 | ₹9,875 | ₹1,481 | ₹4,900 | ₹4,900 |
| 75 HP 4WD | ₹17,20,000 | ₹15,162 | ₹2,274 | ₹8,600 | ₹8,600 |

The floor scales collateral with the asset at risk. It also raises the renter's upfront hold, which matters for a cash-poor farmer, so the pilot measures conversion at stage 3 by tier and the floor is recalibrated against season-one damage claims.

### 5.6 Ledger invariant

Money is held in integer paise. At every instant: `held + owner payout + platform take + renter refund = pre-authorisation`. The portal's escrow engine is property-tested against 2,000 random sequences of renter, owner, device and platform events, including replays, out-of-order and hostile values. In every sequence money is conserved, nothing goes negative, terminal states stay terminal and no owner payout happens while a dispute is open [measured: `services/client-portal/lib/escrow-machine.test.ts`].

### 5.7 Disposition matrix

| Outcome | Base rental | Security deposit |
|---|---|---|
| Clean return | Billed amount → owner (minus take-rate); unused hours refunded | Refunded |
| D-01 confirmed | → owner | Forfeited to owner |
| D-03 over-use | Owner + excess-hour charge | Offset by the excess, balance refunded |
| D-05 damage | → owner | Offset to repair estimate, balance refunded |
| D-06 no-show | Refunded | Refunded |
| D-07 plate mismatch at P1 | Refunded | Refunded; travel compensation charged to lister |
| D-08 breakdown | Verified ΔH only → owner | Refunded |
| D-09 cancelled after cap | Verified ΔH only → owner | Refunded |

---

## 6. Edge Case Taxonomy

| Class | Scenario | Required behaviour | Covered by |
|---|---|---|---|
| **2G offline dropout** | Device loses signal mid-window, reconnects hours later and replays frames | Server converges; hours never double-counted; old frames never overwrite newer data; the full track is kept so rules still see what happened offline | CRDT LWW merge; `telemetry_points` primary-key dedup; per-sample track retention (audit remediation 10) |
| | Renter drives off-parcel for 90 s during a blackout, returns before reconnecting | D-01 fires on replay | Track-based D-01 evaluation (remediation 10) |
| | Single GPS jump > 500 m from drift | No breach | D-01 60 s grace |
| | Device offline for 24 h while the machine works | No false refund | D-06 `NO_SHOW_PENDING` |
| **GPS spoofing** | Spoofer holds the reported position inside the parcel | Flag | D-01b frozen-fix rule |
| | Spoofer teleports position between fields | Flag | D-01b speed rule |
| **Meter tampering** | ECU reading wound back below the last reading | Tamper, regardless of size | D-02 monotonic rule |
| | GPS shows no travel (stationary threshing) | Not a tamper signal by itself | D-02 judged by fuel burn vs ECU hours |
| **Mid-lease breakdown** | Machine fails after P1, before planned return | Renter pays verified ΔH only; owner bears repair; nearest replacement offered | D-08, `SUSPENDED_BREAKDOWN` |
| **Weather delay** | Rain blocks fieldwork after dispatch | Billing clock paused; window extended up to 48 h; then pro-rata cancel | D-09 |
| **Dispute escalation** | A party contests an automatic ruling | Evidence frozen, ops review, resolved ≤ 72 h | `DISPUTE_OPEN` SLA |
| **Payment timeout** | Provider slower than 30 s, then approves late | Machine released and authorisation voided; late approval ignored | FR-4 (remediations 4–5) |
| **Concurrent booking** | Two renters book the same machine in the same second | Exactly one wins | Redlock + database fencing (remediations 1, 6–8) |
| **Paused process** | Booking service pauses 10 s (GC, VM migration) after its lock expires, then resumes and writes | Its write is rejected by the database | Fencing predicate `fencing_token <= $token` (remediation 1) |
| **Duplicate request** | 2G retry resends `POST /bookings` | One booking | Idempotency-Key UNIQUE |
| **Fraudulent listing** | Stolen or pledged tractor listed | Blocked before any booking | D-07 at listing |

---

## 7. Quantitative Unit Economics

### 7.1 The pricing formula

```
Rate = (B_base × μ_season × δ_soil) + (D_wear × κ_age) + (F_consumption × P_fuel)
```

| Symbol | Meaning | Values in v2.0 |
|---|---|---|
| B_base | Base market rate by HP tier (₹/h) | 35 HP 300 · 45 HP 420 · 55 HP 520 · 75 HP 4WD 780 |
| μ_season | Seasonal surge multiplier | off-season 1.00 · sowing 1.20 · harvest surge 1.45 |
| δ_soil | Soil-resistance coefficient | sandy 0.90 · alluvial loam 1.00 · black-cotton clay 1.25 |
| D_wear | Depreciation per engine hour | acquisition cost ÷ 10,000 h |
| κ_age | Vintage multiplier | 1 + 0.05 × age in years |
| F_consumption | Diesel litres per hour by tier | 3.2 · 4.0 · 5.2 · 7.8 |
| P_fuel | District diesel price (₹/L) | live input; ₹91 in examples |

The three terms are economically distinct ([ADR-0004](adr/0004-dynamic-depreciation-pricing.md)):

1. **Market term** prices scarcity: the same machine is worth more per hour in a 12-day harvest window and in heavy clay.
2. **Wear term** recovers capital pro-rata to use, so a machine pays for its own depreciation hour by hour; older machines recover more per hour because their remaining life is shorter.
3. **Fuel term** passes diesel through at cost. The platform earns nothing on fuel, so its margin does not move with diesel prices, and the owner is not tempted to under-fuel.

### 7.2 Worked example (M-101) [model]

45 HP, 5 years old, ₹6,40,000, alluvial loam, harvest surge, diesel ₹91/L:

| Term | Calculation | ₹/h |
|---|---|---|
| Market | 420 × 1.45 × 1.00 | 609.00 |
| Wear | (6,40,000 ÷ 10,000) × (1 + 0.05 × 5) = 64 × 1.25 | 80.00 |
| Fuel | 4.0 × 91 | 364.00 |
| **Hourly rate** | | **1,053.00** |
| Owner net | (1,053.00 − 364.00) × (1 − 0.135) | 595.99 |

The same numbers are reproduced to the paisa by the portal's TypeScript engine (golden test) and by `python3 analytics/pricing.py`.

### 7.3 Farmer savings against a broker

If a broker charges a markup *m* over the platform rate, the farmer's saving is `1 − 1/(1 + m)`. At the assumed *m* = 38 % that is **27.5 %**, not 38 % [model]. Whether brokers really mark up 38 % is the first thing the pilot survey checks (§12).

### 7.4 Owner payback and the take-rate

Payback = acquisition cost ÷ (owner net per hour × rented hours per year). Before operator wages, maintenance and insurance, so real payback is longer.

**Harvest-rate case (M-101), payback in years [model]:**

| Take-rate | Owner net ₹/h | 250 h/yr | 400 h/yr | 620 h/yr |
|---|---|---|---|---|
| 12.0 % | 606.32 | 4.22 | 2.64 | 1.70 |
| 13.5 % | 595.99 | 4.30 | 2.68 | 1.73 |
| 15.0 % | 585.65 | 4.37 | 2.73 | 1.76 |

**Season-blended case** (30 % of hours at harvest rates, 30 % sowing, 40 % off-season; blended owner net ₹503.35/h at 13.5 %): **5.09 years at 250 h → 3.18 at 400 h → 2.05 at 620 h** [model].

Two conclusions:

1. **Utilisation, not take-rate, drives owner economics.** Moving the take-rate across the whole 12–15 % band changes payback by about 0.15 years at 250 h. Moving from 250 to 620 hours cuts it by more than half.
2. **The take-rate is defensible at 12–15 %.** The broker captures an assumed 27.5 % of the farmer's spend without holding the money, verifying the machine or guaranteeing anything. The platform takes roughly half of that and in return carries the escrow, the telematics verification and the dispute process.

**With owner running costs and droughts** (operator ₹80/h, maintenance ₹55/h, ₹12,000/yr fixed [assumption]; one year in four loses 40 % of hours [assumption]): payback is **9.03 years at 250 h, 5.31 at 400 h and 3.31 at 620 h**; repaying a ₹6.4 L tractor inside a 5-year loan needs about **422 rented hours in a normal year** [model: `owner_cash_case` in `analytics/results/pricing_report.json`]. Per-hour costs fall with hours, so a drought year moves payback by 11–13 %, not by the 40 % of hours it loses.

### 7.5 Platform contribution per booking [model]

For M-101 at harvest rates, 8 billed hours: GMV ₹8,424; fuel pass-through ₹2,912; take-rate base (rental excluding fuel) ₹5,512; platform take at 13.5 % ₹744. Payment, telematics-device and support costs per booking are [assumption] inputs to the pilot P&L and are not yet modelled.

---

## 8. Success Metrics

Formulas live in [`analytics/kpis.py`](../analytics/kpis.py) and are computed from outbox events and `telemetry_points`.

| KPI | Formula | Pilot target [assumption] |
|---|---|---|
| Liquidity Index (per H3 Res-7 district) | `min(supply, demand) / max(supply, demand) × 1 / p95_wait` | ≥ 0.25 |
| Time-to-Fulfill | median(t_confirmed − t_search) | ≤ 30 min |
| Equipment Utilisation | billed hours ÷ (active days × 24) | 250 → 400 h/yr in season one |
| Funnel conversion | stage-to-stage conversion, §3.1 | Stage 2 → 3 ≥ 40 % |
| Dispute rate | disputes ÷ settled bookings | < 5 % |
| Escrow auto-resolution | disputes closed by rules without ops | ≥ 70 % |
| Dispute SLA | share of disputes resolved ≤ 72 h | ≥ 95 % |
| Ledger breaks | bookings where the conservation invariant fails | 0 |

---

## 9. Release Plan

| Milestone | Scope | Exit criterion |
|---|---|---|
| M0 — Hardening (done 2026-10-24) | Audit remediations 1–12 (Track A) and contract fixes 13–22 (Track B) | All 20 `TestAudit_*` tests green; state sets identical across contract, code and database |
| M1 — Closed pilot | 2 districts, 1 CHC each, 20 machines, assisted onboarding | 100 settled bookings; dispute rate measured |
| M2 — Open pilot | Self-serve listing with D-07 at listing; D-08/D-09 live | Liquidity Index ≥ 0.25 in both districts |
| M3 — Scale | 10 districts; deposit floors recalibrated on claim data | Auto-resolution ≥ 70 %; 0 ledger breaks |

---

## 10. Audit Remediation Register

Source: [`docs/audit/phase1-invariant-audit.md`](audit/phase1-invariant-audit.md). Owner: **A** = Track A (systems), **B** = Track B (product and risk).

| # | Remediation | Owner | Status |
|---|---|---|---|
| 1 | Fencing predicate `fencing_token <= $token` | A | Done |
| 2 | Saga aborts on 0 rows affected | A | Done |
| 3 | Outbox row in the same transaction as the state change | A | Done |
| 4 | Guarded, idempotent compensation | A | Done |
| 5 | Void escrow on every compensating path; late approval compensates | A | Done |
| 6 | Owner-checked heartbeat with lost-lock signal | A | Done |
| 7 | Validity-time check after quorum | A | Done |
| 8 | Fencing token minted after winning, from Postgres | A | Done |
| 9 | Orchestrator owns the lock lifecycle | A | Done |
| 10 | Telemetry track retained; D-01 over time | A | Done |
| 11 | D-01 measured from the parcel edge | A | Done |
| 12 | Deterministic D-02 boundary | A | Done |
| 13 | `DISPUTE_OPEN`, `SUSPENDED_BREAKDOWN`, `NO_SHOW_PENDING` in contract, code and database | A + B | Done (one state set enforced across OpenAPI, event schema, saga and SQL by `docs/check_docs.py`) |
| 14 | One deposit definition | B | Done |
| 15 | One geofence definition | B | Done |
| 16 | D-01b GPS spoof rule | B | Specified |
| 17 | D-02 monotonic and stationary-work amendments | B | Specified |
| 18 | D-06 safe under 2G blackouts | B | Specified |
| 19 | D-07 at listing | B | Specified |
| 20 | D-08 mid-lease breakdown | B | Specified |
| 21 | D-09 weather pause | B | Specified |
| 22 | 72 h dispute SLA | B | Specified |

---

## 11. Out of Scope (v2.0)

Dedicated API gateway and escrow microservice (planned containers), live payment-provider and Vahan/Aadhaar integrations, native mobile app, Kafka client wiring beyond the transactional outbox, and IMD weather-feed integration for D-09 (specified, not built).

---

## 12. Open Questions

1. **Broker markup and window length.** Validate the 38 % markup and the 12-day window with a district price survey (≥ 50 farmers, 2 districts) before any external use of the savings figure.
2. **Utilisation baseline.** Confirm 250 h/yr from CHC logbooks and scheme reports.
3. **Deposit floors.** Do 0.5 %-of-asset floors depress conversion for the smallest farmers? Measure stage-3 conversion by tier in M1.
4. **GPS-spoof threshold.** Is 40 km/h right for tractors on rural roads? Calibrate from M1 tracks.
5. **Owner opex.** Modelled in §7.4 with planning values; replace them with CHC logbook costs per tier.
6. **Dispute ownership.** Platform ops or a third-party agronomist for D-05 damage disputes?
7. **D-08 replacement.** Who pays the replacement machine's travel to the parcel?

---

## Appendix A — Glossary

| Term | Meaning |
|---|---|
| CHC | Custom Hiring Centre, a scheme-funded machinery rental unit |
| ΔH | Engine hours used: H_final − H0 from the CAN-bus meter |
| H3 | Uber's hexagonal hierarchical spatial index; Res 7 ≈ 1.2 km edge, Res 8 ≈ 460 m, Res 9 ≈ 174 m |
| Fencing token | A number that increases with every lock grant; the database rejects writes carrying an older one |
| Transactional outbox | Writing an event to an `outbox_events` table in the same transaction as the state change, then publishing it |
| CRDT | Conflict-free replicated data type; here an LWW-Element-Set that converges regardless of message order |
| P1 / P2 | The pre-dispatch and post-return escrow gates |
| Take-rate | The platform's commission on the billed amount |
