# ADR-0002: Kafka Saga (orchestrated) vs 2PC for cross-service booking

- **Status:** Accepted
- **Date:** 2026-06

## Context
A booking spans four systems that own different data and can each fail
independently: inventory hold, escrow authorization (30 s SLA), dispatch
notification, and telematics. 2PC (XA) across Postgres + Redis + the escrow
provider is the textbook "strong consistency" answer — and the wrong one here.

## Decision
Use an **orchestrated Kafka saga** with a **transactional outbox** and
**fencing tokens**, not 2PC.

## Rationale
- **Availability over atomicity.** A harvest-window booking must stay
  bookable even if one downstream is degraded. 2PC blocks on the slowest
  participant (a 30 s escrow hold would stall the entire match); a saga
  proceeds to the point of failure and *compensates* only what it did.
- **The 30 s escrow SLA is a timeout, not a transaction.** The forward path
  (`ReserveInventory → AuthorizeEscrowDeposit → DispatchNotification`) emits a
  compensation (`CompensateInventoryReservation → FAILED_PAYMENT_RELEASED`)
  when the escrow leg fails or exceeds the SLA.
- **Dual-write prohibition.** The outbox pattern commits the state mutation
  and the event in one Postgres transaction; CDC/publisher drains it to Kafka
  with at-least-once delivery. Inbox dedup makes replay idempotent.
- **Fencing tokens** close the "stale lock writer corrupts state" hole that
  raw Redlock leaves open under GC pauses — every write carries a monotonic
  token the DB rejects if it has lapsed.

## Consequences
- We accept *eventual* consistency; a booking can transiently show a state
  the escrow provider hasn't caught up on. UIs must handle "pending".
- We need the outbox + inbox tables and a reliable publisher (implemented in
  `showcase/go/booking-orchestrator/internal/{saga,events}`).
- Compensation must be idempotent and safe to run more than once.
