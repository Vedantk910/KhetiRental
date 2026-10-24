# KhetiRental v2.0 — Two-Track Implementation Plan (Stage 2)

> Status: DRAFT for approval. No files created yet. `git-guard.sh` and `settings.json` untouched.

## 1. Repository Layout & Ownership Map

```
khetirental/
├── GLOSSARY.md                     # Track C (shared) — domain vocabulary
├── CLAUDE.md                       # Track C (shared) — agent instructions
├── .gitignore                      # Track C (shared)
├── .claude/                        # Track C (shared) — skills + hooks
│   ├── skills/                     #   8 dual-track skills (installed)
│   ├── hooks/git-guard.sh          #   destructive-command blocker (existing)
│   ├── hooks/commit-guard.sh       #   ownership-aware commit guard (NEW)
│   └── settings.json               #   PreToolUse hook wiring (updated)
│
├── services/                       # ── TRACK A (brother) ─────────────────
│   ├── matching-engine/            #   Go, Uber H3 spatial matching, Redis GEO
│   ├── booking-orchestrator/       #   Go, Kafka Saga, Redlock fencing tokens
│   ├── telemetry-gateway/          #   Go, CAN-bus + GPS ingestion, anomaly detect
│   └── settlement-service/         #   Go, 3-stage escrow state machine
├── showcase/deploy/                         # ── TRACK A (brother) ─────────────────
│   ├── k8s/                        #   manifests, Helm values
│   └── docker/                     #   Dockerfiles, compose
├── tests/
│   └── load/                       # ── TRACK A (brother) ─────────────────
│       ├── k6/                     #   k6 scripts (5k VU, p99<25ms)
│       └── integration/            #   Go integration tests
├── showcase/contracts/                      # ── TRACK B (vedant) ─────────────────
│   ├── openapi.yaml                #   OpenAPI 3.1 — all API boundary schemas
│   └── events/                     #   Kafka event schemas (protobuf/JSON)
├── docs/
│   ├── PRD.md                      # ── TRACK B (vedant) ─────────────────
│   ├── adr/                        # ── TRACK B (vedant) ─────────────────
│   │   ├── 0001-h3-vs-postgis.md
│   │   ├── 0002-kafka-saga-vs-2pc.md
│   │   ├── 0003-3-stage-escrow.md
│   │   └── 0004-dynamic-depreciation.md
│   └── architecture.md             # ── shared (both may annotate) ───────
├── showcase/analytics/
│   └── pricing.py                  # ── TRACK B (vedant) ─────────────────
└── .scratch/                       # ── shared (issue tracker, both tracks)
    └── <feature-slug>/
```

## 2. Ownership Rules (enforced by `commit-guard.sh` once installed; manual `git config user.name/email` until then)

| Path | Owner | Conventional prefix | GitHub login |
|---|---|---|---|
| `services/**` (Go: matching-engine, booking-orchestrator, telemetry-gateway) | Track A | `perf(geo):` `feat(concurrency):` `feat(saga):` `feat(telemetry):` `feat(crdt):` | `tarunkonde05-hub` |
| `showcase/deploy/**` | Track A | `infra(k8s):` `infra(docker):` | `tarunkonde05-hub` |
| `showcase/tests/load/**` (k6, integration) | Track A | `test(k6):` `test(integration):` | `tarunkonde05-hub` |
| `showcase/contracts/**` (OpenAPI, Kafka events, escrow state machine) | Track B | `spec(api):` `spec(event):` `spec(escrow):` | `Vedantk910` |
| `showcase/docs/PRD.md`, `showcase/docs/adr/**` | Track B | `docs(prd):` `docs(adr):` | `Vedantk910` |
| `showcase/analytics/**` (pricing.py, kpis.py) | Track B | `model(pricing):` `model(econ):` `model(kpi):` | `Vedantk910` |
| `showcase/ARCHITECTURE.md` | Shared (Track C) — annotated by both; Lead 1 owns diagrams, Lead 2 owns tables | `docs(arch):` | Either |
| `.scratch/**`, `CLAUDE.md`, `.claude/**`, `.gitignore`, root files | Shared (Track C) | `chore:`, `docs:`, `infra:`, any valid prefix | Either |

A commit is **blocked** if its author does not match the track required by the staged paths. A commit touching **multiple** track-specific paths is also blocked (mixed-track) — split it into separate commits.

A commit is **blocked** if its author does not match the track required by the staged paths. A commit touching **multiple** track-specific paths is also blocked (mixed-track) — split it into separate commits.

## 3. Implementation Sequence

**Phase 0 — Foundations (Track B first, unblocks Track A):**
1. `showcase/docs/PRD.md` + `showcase/docs/adr/0001-h3-vs-postgis.md` (Track B)
2. `showcase/contracts/openapi.yaml` v0 — service boundary skeletons, Idempotency-Key headers (Track B)
3. `showcase/contracts/events/booking-events.schema.json` — Kafka event contract (Track B)
4. `git init` + first commit + push to shared repo (Track C)

**Phase 1 — Core backend (Track A):**
5. `showcase/go/matching-engine/` — H3 indexing, Redis GEO, `GET /machines/near?lat&lng&radius_m` (Track A)
6. `showcase/go/booking-orchestrator/` — Kafka Saga, Redlock + fencing tokens, outbox pattern (Track A)
7. `showcase/tests/load/k6/matching-engine.js` — p99<25ms at 5k VUs (Track A)

**Phase 2 — Telematics & Settlement (Track A):**
8. `showcase/go/telemetry-gateway/` — CAN-bus + GPS ingest, geofence anomaly flags (Track A)
9. `services/settlement-service/` — 3-stage escrow state machine (Track A)

**Phase 3 — Product & Economics (Track B, in parallel with Phases 1–2):**
10. `showcase/docs/adr/0002`–`0004` (Kafka Saga, 3-stage escrow, dynamic pricing) (Track B)
11. `showcase/analytics/pricing.py` — depreciation model, take-rate sensitivity (Track B)
12. `showcase/contracts/openapi.yaml` v1 — full response schemas (Track B)

**Phase 4 — Integration & Load (Track A + Track B review):**
13. `showcase/tests/load/k6/full-flow.js` — end-to-end booking + escrow + settlement (Track A)
14. `showcase/deploy/k8s/` + `showcase/deploy/docker/` — full stack manifests (Track A)
15. Load test report + ADR-0005 (if any infra decision needed) (Track A + B)

## 4. API & Event Contract Boundaries

- **All service-to-service calls go through `showcase/contracts/openapi.yaml`** — Track B owns the spec; Track A implements against it. Track A cannot add endpoints without a PR to `showcase/contracts/`.
- **All cross-service async messages go through `showcase/contracts/events/`** — Kafka event schemas are versioned; Track B defines schemas; Track A produces/consumes.
- **Track B never touches `services/`**; **Track A never touches `showcase/docs/PRD.md`** or `showcase/analytics/`**.
- `docs/architecture.md` is shared — both tracks may annotate; conflicts resolved by senior reviewer.

## 5. Integration, Review & Merge

- **Branch model:** `main` (protected) + `feat/<track>-<feature>` branches, one PR per track.
- **PR review:** Track A code reviewed by Track B (and vice versa) before merge; at least one cross-track approval required.
- **Merging to `main`:** Only via PR; no direct push. Both accounts have write access; PR merge requires cross-track review to enforce the ownership boundary.
- **Conflicts in shared files:** `.scratch/`, `CLAUDE.md`, `docs/architecture.md` — resolve by rebase, never by force; last-write-wins is not acceptable for ADRs.
- **Force-push:** Blocked by `git-guard.sh` for both accounts.

## 6. Account Selection & Identity Verification (per-push protocol)

Before **every push**, run this verification:

```bash
# 1. Confirm who you are on GitHub (no token shown)
gh auth status

# 2. Confirm git commit author is set for the current track
git config user.name     # must match track owner
git config user.email    # must match track commit email

# 3. Confirm the push target remote
git remote -v           # must show: origin  https://github.com/tarunkonde05-hub/KhetiRental.git
```

`git-guard.sh` (existing) blocks destructive commands for **both** accounts.
`commit-guard.sh` (new) blocks commits where the author doesn't match the staged track paths.

**To switch account for a push:**
- Commit as Track A → push with `gh auth login` as `tarunkonde05-hub` still active (or `git push` uses its stored credential).
- Commit as Track B → `gh auth login --web` as `Vedantk910`, then `git push`.
- The two identities are **independent**: changing the gh account does not change the git author; always verify `git config user.email` before committing.
