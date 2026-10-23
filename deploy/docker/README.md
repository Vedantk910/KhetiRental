# Deploy scaffolding (Lead 1: infrastructure)

Place Dockerfiles per service and a `docker-compose.yml` that wires:

- `matching-engine`   → redis
- `booking-orchestrator` → postgres, redis (Redlock quorum), kafka
- `telemetry-gateway`  → redis (CRDT state), kafka (telemetry.events)
- `escrow-service`     → postgres, kafka

Database migrations live in `deploy/sql/` (run `deploy/sql/test_migrations.sh`
against a Postgres to verify them).

K8s manifests go in `deploy/k8s/` (stateful workloads for postgres, redis
cluster, kafka; deployments for the stateless services).

> Intentionally left as a directory scaffold, not populated binaries, until
> the services have passing integration tests. See
> `docs/commit-sequence.md` A10 (`infra(k8s):`).
