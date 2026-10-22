# KhetiRental v2.0 — Git Commit Sequence (provenance)

> 10+ commits per lead, in dependency order. Each lead commits under their
> own identity; the conventional prefix matches the track's ownership map in
> `.scratch/khetirental-git-setup/PLAN.md`. No co-author trailers — author is
> exactly one account per commit (Track A = `tarunkonde05-hub`, Track B =
> `Vedantk910`).
>
> **Prerequisite:** before each commit, set the repo-local author:
> ```bash
> # Track A
> git config user.name tarunkonde05-hub && git config user.email tarunkonde05@gmail.com
> # Track B
> git config user.name Vedantk910 && git config user.email vedantkonde910@gmail.com
> ```

## Track A — Brother (distributed systems) — 12 commits

| # | Command / files | Prefix |
|---|---|---|
| A1 | `git add services/matching-engine/go.mod services/matching-engine/internal/h3geo/ && git commit -m "perf(geo): H3 Res7-9 spatial index + Redis k-ring store"` | `perf(geo):` |
| A2 | `git add services/matching-engine/internal/ranker/ && git commit -m "perf(geo): multi-criteria ranker (distance decay + HP match + reputation)"` | `perf(geo):` |
| A3 | `git add services/matching-engine/internal/store/ services/matching-engine/cmd/ && git commit -m "feat(concurrency): /machines/near HTTP handler + match-service entrypoint"` | `feat(concurrency):` |
| A4 | `git add services/booking-orchestrator/go.mod services/booking-orchestrator/internal/redlock/ && git commit -m "feat(concurrency): Redlock + monotonic fencing tokens + lease heartbeat"` | `feat(concurrency):` |
| A5 | `git add services/booking-orchestrator/internal/saga/ services/booking-orchestrator/internal/events/ && git commit -m "feat(saga): Kafka orchestrator with outbox + compensating rollback"` | `feat(saga):` |
| A6 | `git add services/telemetry-gateway/go.mod services/telemetry-gateway/internal/crdt/ && git commit -m "feat(crdt): LWW-Element-Set CRDT for 2G/3G telemetry sync"` | `feat(crdt):` |
| A7 | `git add services/telemetry-gateway/internal/ws/ && git commit -m "feat(telemetry): WebSocket sync protocol + per-machine Hub"` | `feat(telemetry):` |
| A8 | `git add services/telemetry-gateway/internal/geo/ services/telemetry-gateway/cmd/ && git commit -m "feat(telemetry): geofence + hour-tamper anomaly detection"` | `feat(telemetry):` |
| A9 | `git add tests/load/k6/ && git commit -m "test(k6): 5,000-VU harvest-surge load script with p95/p99 SLA gates"` | `test(k6):` |
| A10 | `git add deploy/ && git commit -m "infra(k8s): Dockerfiles + K8s manifests + Redis/Kafka/Timescale stateful workloads"` | `infra(k8s):` |
| A11 | `git add services/booking-orchestrator/ && git commit -m "feat(saga): idempotent inbox dedup + outbox publisher"` | `feat(saga):` |
| A12 | `git add tests/ && git commit -m "test(integration): matching + saga + CRDT round-trip tests"` | `test(integration):`

## Track B — Vedant (product & risk) — 12 commits

| # | Command / files | Prefix |
|---|---|---|
| B1 | `git add contracts/openapi.yaml && git commit -m "spec(api): OpenAPI 3.1 contract — matching + booking + escrow endpoints"` | `spec(api):` |
| B2 | `git add contracts/events/ && git commit -m "spec(event): Kafka event schemas (booking, telemetry, escrow, pricing)"` | `spec(event):` |
| B3 | `git add contracts/escrow-state-machine.md && git commit -m "spec(escrow): 3-stage milestone-gated escrow + D-01..D-07 dispute rules"` | `spec(escrow):` |
| B4 | `git add analytics/pricing.py && git commit -m "model(pricing): dynamic depreciation pricing engine (base×season×soil + wear + fuel)"` | `model(pricing):` |
| B5 | `git add analytics/kpis.py && git commit -m "model(kpi): Liquidity / Time-to-Fulfill / EUR formulas + tracking"` | `model(kpi):` |
| B6 | `git add docs/adr/0001-h3-vs-postgis.md && git commit -m "docs(adr): ADR-0001 H3 vs PostGIS spatial index"` | `docs(adr):` |
| B7 | `git add docs/adr/0002-kafka-saga-vs-2pc.md && git commit -m "docs(adr): ADR-0002 Kafka Saga vs 2PC"` | `docs(adr):` |
| B8 | `git add docs/adr/0003-3-stage-escrow.md && git commit -m "docs(adr): ADR-0003 3-stage escrow vs instant capture"` | `docs(adr):` |
| B9 | `git add docs/adr/0004-dynamic-depreciation-pricing.md && git commit -m "docs(adr): ADR-0004 dynamic depreciation pricing"` | `docs(adr):` |
| B10 | `git add ARCHITECTURE.md && git commit -m "docs(arch): C4 containers + data-store map + event map"` | `docs(arch):` |
| B11 | `git add docs/commit-sequence.md && git commit -m "docs(prd): commit provenance map for both leads"` | `docs(prd):` |
| B12 | `git add contracts/schemas/ && git commit -m "spec(api): shared machine/booking/telemetry data schemas"` | `spec(api):`

## Shared / Track C (either lead)

| # | Command / files | Prefix |
|---|---|---|
| C1 | `git add .gitignore .claude/ && git commit -m "chore: .gitignore + dual-track skills + safety hooks"` | `chore:` |
| C2 | `git add docs/agents/ && git commit -m "docs: agent issue-tracker + domain-doc conventions"` | `docs:` |

## Merge order (branch model)

Each lead works on `feat/track-<a|b>-<feature>` off `main`, opens a PR, and
the **other** lead reviews (cross-track) before merge. `main` is protected:
no direct pushes, no force pushes (`git-guard.sh` enforces the latter).
