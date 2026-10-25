# KhetiRental v2.0 — System Architecture

> Agritech machinery sharing + 3-stage milestone escrow platform.
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
│  │   auth (JWT), rate-limit, OpenAPI contract: showcase/contracts/openapi  │   │
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

| Container | Tech | Responsibilities |
|---|---|---|
| `showcase/go/matching-engine` | Go 1.22, uber/h3-go/v4, go-redis/v9 | O(1) spatial queries via H3 k-rings; multi-criteria ranking |
| `showcase/go/booking-orchestrator` | Go, go-redis/v9 (Redlock); Kafka producer behind the `Producer` interface (client not yet wired) | Saga state machine, outbox, compensations, fencing tokens |
| `showcase/go/telemetry-gateway` | Go, gorilla/websocket, CRDT (LWW-Element-Set) | 2G/3G-tolerant offline sync, geofence + hour-tampering alerts |
| `showcase/contracts/` (OpenAPI 3.1 + Kafka event schemas) | YAML/JSON | Single seam between the services and the risk model |
| `showcase/analytics/pricing.py`, `showcase/analytics/kpis.py` | Python 3.12 | Dynamic depreciation pricing; Liquidity / TTF / EUR |
| `showcase/docs/adr/` | Markdown | H3-vs-PostGIS, Saga-vs-2PC, 3-stage escrow, dynamic pricing |
| `showcase/deploy/sql/` | PostgreSQL 17 (+ TimescaleDB when installed) | Migrations: bookings, outbox/inbox, telemetry hypertable; `test_migrations.sh` |

> **Planned, not yet implemented:** the API Gateway and `escrow-service` containers shown in the context diagram. Escrow rules live in `showcase/contracts/escrow-state-machine.md`; the gateway role is currently played by each service's own HTTP mux.

## C4 — Component highlights

- **Matching engine** (`showcase/go/matching-engine/internal/h3geo`): `Cell(lat,lng,7|8|9)` → uint64; `NearCells(cell, k)`; Redis hash `machines:h3:<cell>` (field = machine id, value = `lat,lng,hp,rep`); one `HGETALL` pipeline over the k-ring, no second round trip for ranking attributes. No PostGIS, no Haversine on write path (see ADR-0001).
- **Booking saga** (`showcase/go/booking-orchestrator/internal/saga`): 7-node state machine (`Pending → InventoryReserved → EscrowAuthorized → Dispatched → Active → PostReturn → Settled` with `Failed*` branches), Kafka-produced via outbox (ADR-0002).
- **Redlock** (`internal/redlock`): n/2+1 quorum, monotonic **fencing token** minted per acquire, 5 s TTL, 2 s heartbeat goroutine, Lua-fenced deletes (ADR-0002).
- **CRDT sync** (`showcase/go/telemetry-gateway/internal/crdt`): LWW-Element-Set keyed on `(machine_id, metric, observed_at)` with per-node Lamport + node id as tiebreak; merges are idempotent and commutative — designed for 2G packet drop/reorder.
- **Escrow state machine** (`showcase/contracts/escrow-state-machine.md`): 3-stage gates, auto-dispute detection rules, deposit freeze triggers.

## Data store map

| Store | Used by | Notes |
|---|---|---|
| PostgreSQL 15 | orchestrator (bookings, outbox, inbox) | ACID, logical replication for CDC outbox tail |
| Redis 7 (cluster) | matching-engine, redlock, telemetry cache | per-cell spatial hashes + Redlock quorum |
| TimescaleDB (Postgres extension) | telemetry-gateway, analytics | hypertables, 5-min continuous aggregates for TTF/EUR |
| Kafka (3-broker) | all services | topics: `booking.events`, `telemetry.events`, `escrow.events`, `pricing.events` |

## Event map (contract = `showcase/contracts/events/*.json`)

| Topic | Producer | Consumers |
|---|---|---|
| `booking.events` | orchestrator | matching-engine (lock release), escrow, telemetry |
| `telemetry.events` | telemetry-gateway | escrow (hour validation), analytics (EUR) |
| `escrow.events` | escrow service | orchestrator (settlement completion), analytics |
| `pricing.events` | analytics | matching-engine (rank boost for cheaper machines) |

## Load-testing target (see `showcase/tests/load/k6/full_flow.js`)

- 5,000 VUs, ramp 100 → 5,000 over 60 s, sustain 120 s, ramp down 30 s
- Pass gates: `p(95) < 10 ms`, `p(99) < 25 ms`, `http_req_failed rate < 0.001` (0.1 %)
- 0.5–1.5 s renter think time per iteration; `setup()` seeds 20,000 machines over a ~110 km box around Jaipur

**Measured (2026-10-24, single Apple-silicon laptop, k6 + service + Redis co-located, Res8):**
p95 **0.66 ms**, p99 **2.91 ms**, 0.00 % failures, ~4,000 req/s sustained at 5,000 VUs. Co-location means
this is a lower bound on headroom; rerun from a separate load host before quoting it externally.
