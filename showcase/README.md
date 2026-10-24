# KhetiRental v2.0

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Deployed-emerald.svg)](https://khetirental.vercel.app)

KhetiRental is a marketplace for renting tractors and other farm machinery by the hour. Small farmers cannot buy a tractor and today rent through informal brokers who set the price and leave no record when something goes wrong. Owners leave machines idle because renting to strangers is risky. v2.0 adds three things the informal market lacks: nearby-machine search on Uber H3 cells backed by Redis, a three-stage milestone escrow with nine dispute rules, and itemised cost-based pricing. It is built by two people on separate tracks, with a commit hook that enforces who may touch which files.

> The badge and the links below point to `https://khetirental.vercel.app`. That address goes live only after the repository owner imports the repo on Vercel (see [Deploying to Vercel](../README.md#deploy)).

## Live pages

| Page | What it shows |
|---|---|
| [/](https://khetirental.vercel.app/) | Home and headline evidence |
| [/marketplace](https://khetirental.vercel.app/marketplace) | Search, quote and booking flow |
| [/architecture/h3-spatial](https://khetirental.vercel.app/architecture/h3-spatial) | H3 spatial sandbox |
| [/pricing](https://khetirental.vercel.app/pricing) | Itemised hourly price |
| [/escrow](https://khetirental.vercel.app/escrow) | Three-stage escrow simulator |
| [/architecture](https://khetirental.vercel.app/architecture) | System architecture |
| [/dossier/track-a-systems](https://khetirental.vercel.app/dossier/track-a-systems) | Track A systems dossier |
| [/dossier/track-b-product](https://khetirental.vercel.app/dossier/track-b-product) | Track B product dossier |

## Headline numbers

Each figure is taken from `apps/web/lib/evidence.ts`, which names its source file.

| Claim | Value | Source |
|---|---|---|
| Concurrent virtual users, k6 harvest-surge ramp | 5,000, 0.00 % failed requests | `showcase/tests/load/k6/full_flow.js` |
| H3 search latency | p99 2.91 ms (p95 0.66 ms, ~4,000 req/s, single host) | `showcase/ARCHITECTURE.md` |
| Risk-audit tests passing | 20 / 20 | `showcase/docs/audit/phase1-invariant-audit.md` |
| Farmer saving versus a broker | 27.5 %, if brokers add 38 % (an unvalidated assumption) | `showcase/docs/PRD.md` |

The load test ran on one laptop with k6, the service and Redis co-located. Treat it as a single-host measurement, not a production benchmark.

## Zero-Leak Dual-Track Ownership Matrix

`.claude/hooks/commit-guard.sh` rejects any commit that mixes tracks or is authored by the wrong person. Track emails are read from `git config track.a.email` and `track.b.email`.

| Area | Track A: tarunkonde05-hub | Track B: Vedantk910 | Shared |
|---|---|---|---|
| Backend | Go services (`showcase/go/matching-engine`, `booking-orchestrator`, `telemetry-gateway`), H3 matching, Redis/Redlock, Kafka/saga | | |
| Infra and tests | `showcase/deploy/`, `showcase/tests/load/`, `.github/workflows/` | | |
| Product and risk | | `showcase/docs/PRD.md`, `showcase/contracts/`, `showcase/docs/adr/`, `showcase/analytics/`; escrow, payments, risk, pricing | |
| Client portal | H3 sandbox, machines API, systems dossier | Pricing, escrow, marketplace, bookings API, product dossier | Portal shell: config, layout, navbar |
| Repo-wide | | | Root files, `.claude/`, `.scratch/`, `showcase/ARCHITECTURE.md` |

## Repository map

| Path | Contents |
|---|---|
| `showcase/go/matching-engine` | Go: H3 k-ring search over Redis, ranking |
| `showcase/go/booking-orchestrator` | Go: booking saga, transactional outbox, Redlock with fencing tokens |
| `showcase/go/telemetry-gateway` | Go: WebSocket telemetry sync, CRDT merge, geofence and meter checks |
| `apps/web` | Next.js 15 portal (the Vercel deployment) |
| `showcase/contracts/` | OpenAPI 3.1, Kafka event schemas, escrow state machine |
| `showcase/deploy/sql` | PostgreSQL migrations and `test_migrations.sh` |
| `showcase/analytics/` | Python pricing model and KPIs |
| `showcase/tests/load/k6` | k6 load test |
| `docs/` | [PRD](docs/PRD.md), [ADRs](docs/adr), [audit](docs/audit/phase1-invariant-audit.md), `check_docs.py` |
| `.github/workflows` | CI and Vercel deploy |
| [`showcase/ARCHITECTURE.md`](ARCHITECTURE.md) | C4 diagrams, data stores, event map |

## Quick start

Prerequisites: Go 1.22, Node 24 (Vitest 5 needs 22.12 or later), Python 3, Redis on port 6390 and Postgres 17 on port 5440. Integration tests skip when Redis or Postgres is unreachable.

```bash
./test-all.sh                       # every unit and integration suite
cd apps/web
npm ci && npm run dev               # portal on http://localhost:3000
```

`test-all.sh` runs the portal suite only if `npm ci` has been done. CI (`.github/workflows/ci.yml`) runs the Go services against real Redis and Postgres containers, the contract and migration checks, and the portal lint, unit, build and Playwright tests.

## Deploying to Vercel

The workflow `.github/workflows/deploy-portal.yml` deploys on pushes to `main` that touch `apps/web/`. It skips the deploy steps, with a notice, until the secrets exist. One-time manual setup by the repository owner:

1. Import the repo at [vercel.com/new](https://vercel.com/new).
2. Set the root directory to `apps/web` and the framework to Next.js.
3. Add environment variables `NEXT_PUBLIC_APP_ENV=production` and `NEXT_PUBLIC_DEMO_MODE=true`.
4. In the GitHub repo settings, add secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`.

## Provenance

KhetiRental began in September 2023 as an academic prototype and was shortlisted in the Internal Smart India Hackathon 2024 at AISSMS COE. v2.0 is a rebuild as a distributed system, specified in [`showcase/docs/PRD.md`](docs/PRD.md) and [`showcase/ARCHITECTURE.md`](ARCHITECTURE.md).
