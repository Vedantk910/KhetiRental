# ADR-0003: 3-Stage milestone escrow vs instant-capture payment

- **Status:** Accepted
- **Date:** 2026-06

## Context
A rental machine is used over hours/days. Instant capture (charge the full
rental at booking) resolves the renter's default risk but not the asset's:
if the machine is damaged, over-used, or driven off-parcel, the owner is
already paid and recourse is a slow, trust-based dispute. This is the
"informal broker markup" problem the market exists to eliminate.

## Decision
Use a **3-stage milestone-gated escrow**: pre-authorization hold
(100 % rental + 15 % deposit) → Pre-Dispatch inspection gate → active
telematics window → Post-Return audit gate → conditional settlement.
Release of funds is **gated on verifiable milestones**, not on time.

## Rationale (INVEST risk lens)
- **Pre-authorization** gives the renter a "free" cancellation window and
  funds the platform's advance to the owner only after P1 passes.
- **Gates P1/P2** make the owner's and renter's obligations *asymmetrically
  verified*: the owner's machine condition and handover are proven before the
  renter's money moves; the renter's use (geofence, ΔH, fuel, damage) is
  proven before the owner's money moves.
- **Deposit freeze on geofence breach** (D-01) transfers the off-parcel asset
  risk onto the renter without the platform carrying it.
- **Automated dispute rules** (D-01..D-07 in `showcase/contracts/escrow-state-machine.md`)
  make resolution evidence-driven and replayable, not negotiation-driven.

## Consequences
- The escrow service is the *risk* service: its state machine is product
  surface (dispute pages), so the contract owns the thresholds and the
  orchestrator owns the enforcement mechanics.
- Settle-at-time (instant capture) is faster but strictly dominated on risk;
  we accept the operational cost of running the gates.
