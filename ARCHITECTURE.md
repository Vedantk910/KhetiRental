# KhetiRental v2.0 — System Architecture

> Agritech machinery sharing + 3-stage milestone escrow platform.
> Co-authored on two tracks (see [`.scratch/khetirental-git-setup/PLAN.md`](.scratch/khetirental-git-setup/PLAN.md) for the full ownership map).
>
> Provenance: originated Sept 2023 as an academic prototype (shortlisted, Internal Smart India Hackathon 2024 @ AISSMS COE); expanded to a production-grade distributed system in 2026.

---

## C4 — Context

```
┌────────────────────────────────────────────────────────────────────────┐
│                        KHETIRENTAL v2.0 (system)                      │
│                                                                        │
│  Renters (farmers, CHC operators)     Listers (tractor owners, CHCs)  │
│        │  mobile app / web                    │ mobile / web / CSV    │
│        ▼                                        ▼                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                         API Gateway (Go, :8080)                 │   │
│  │   auth (JWT), rate-limit, OpenAPI contract: contracts/openapi  │   │
│  └──────┬──────────────┬───────────────┬───────────────┬──────────┘   │
│         │              │               │               │              │
│         ▼              ▼               ▼               ▼              │
│   matching-       booking-        escrow-         telemetry-         │
│   engine          orchestrator    service         gateway            │
│   (H3+Redis)      (Kafka saga,    (state          (ingest +          │
│                    Redlock,        machine,        anomaly            │
│                    fencing)        settlement)     detection)        │
│                                                                        │
│  External systems:                                                    │
│   • PostgreSQL (ACID bookings/outbox), Redis (locks + spatial cache), │
│   • TimescaleDB (telematics), Kafka (event bus),                      │
│   • Payment/UPI provider, Aadhaar/Vahan KYC APIs, Diesel price feed  │
└────────────────────────────────────────────────────────────────────────┘
```

## C4 — Containers

| Container | Tech | Owner | Responsibilities |
|---|---|---|---|
| `services/matching-engine` | Go 1.22, uber/h3-go/v4, go-redis/v9 | **Lead 1** | O(1) spatial queries via H3 k-rings; multi-criteria ranking |
| `services/booking-orchestrator` | Go, sarama, Redlock | **Lead 1** | Saga state machine, outbox, compensations, fencing tokens |
| `services/telemetry-gateway` | Go, gorilla/websocket, CRDT (LWW-Element-Set) | **Lead 1** | 2G/3G-tolerant offline sync, geofence + hour-tampering alerts |
| `contracts/` (OpenAPI 3.1 + Kafka event schemas) | YAML/JSON | **Lead 2** | Single seam between Lead 1 services and Lead 2 risk model |
| `analytics/pricing.py`, `analytics/kpis.py` | Python 3.12 | **Lead 2** | Dynamic depreciation pricing; Liquidity / TTF / EUR |
| `docs/adr/` | Markdown | **Lead 2** | H3-vs-PostGIS, Saga-vs-2PC, 3-stage escrow, dynamic pricing |

## C4 — Component highlights

- **Matching engine** (`services/matching-engine/internal/h3geo`): `Cell(lat,lng,7|8|9)` → uint64; `NearCells(cell, k)`; Redis key `machines:h3:<cell>`; multi-key `SMEMBERS` pipeline. No PostGIS, no Haversine on write path (see ADR-0001).
- **Booking saga** (`services/booking-orchestrator/internal/saga`): 7-node state machine (`Pending → InventoryReserved → EscrowAuthorized → Dispatched → Active → PostReturn → Settled` with `Failed*` branches), Kafka-produced via outbox (ADR-0002).
- **Redlock** (`internal/redlock`): n/2+1 quorum, monotonic **fencing token** minted per acquire, 5 s TTL, 2 s heartbeat goroutine, Lua-fenced deletes (ADR-0002).
- **CRDT sync** (`services/telemetry-gateway/internal/crdt`): LWW-Element-Set keyed on `(machine_id, metric, observed_at)` with per-node Lamport + node id as tiebreak; merges are idempotent and commutative — designed for 2G packet drop/reorder.
- **Escrow state machine** (`contracts/escrow-state-machine.md`): 3-stage gates, auto-dispute detection rules, deposit freeze triggers.

## Data store map

| Store | Used by | Notes |
|---|---|---|
| PostgreSQL 15 | orchestrator (bookings, outbox, inbox) | ACID, logical replication for CDC outbox tail |
| Redis 7 (cluster) | matching-engine, redlock, telemetry cache | spatial sets + Redlock quorum |
| TimescaleDB (Postgres extension) | telemetry-gateway, analytics | hypertables, 5-min continuous aggregates for TTF/EUR |
| Kafka (3-broker) | all services | topics: `booking.events`, `telemetry.events`, `escrow.events`, `pricing.events` |

## Event map (contract = `contracts/events/*.json`)

| Topic | Producer | Consumers |
|---|---|---|
| `booking.events` | orchestrator | matching-engine (lock release), escrow, telemetry |
| `telemetry.events` | telemetry-gateway | escrow (hour validation), analytics (EUR) |
| `escrow.events` | escrow service | orchestrator (settlement completion), analytics |
| `pricing.events` | analytics | matching-engine (rank boost for cheaper machines) |

## Implementation order (10+ commits per lead)

Full sequence in [`.scratch/khetirental-git-setup/PLAN.md`](.scratch/khetirental-git-setup/PLAN.md). Each lead's next commit should follow the conventional prefixes in `.claude/skills/git-guardrails-dual-track/SKILL.md` (Track A: `perf(geo):`, `feat(concurrency):`, `infra(k8s):`, `test(k6):`; Track B: `docs(prd):`, `spec(api):`, `model(pricing):`, `feat(escrow-ui):`).

## Load-testing target (see `tests/load/k6/full_flow.js`)

- 5,000 VUs, ramp 100 → 5,000 over 60 s, sustain 120 s, ramp down 30 s
- Pass gates: `p(95) < 10 ms`, `p(99) < 25 ms`, `http_req_failed rate < 0.001` (0.1 %)
