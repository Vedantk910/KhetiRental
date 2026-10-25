# KhetiRental

A website where farmers rent tractors and other farm machines from owners nearby, and owners earn from machines that would otherwise sit idle. Marathi, Hindi and English; built mobile-first for budget phones on slow networks.

> **Status:** being rebuilt to the plan in [`REVIEW.md`](REVIEW.md) (Part 0, milestones M0–M8) and [`UI-SPEC.md`](UI-SPEC.md). All data is sample data and payments are simulated: no real money moves.

## Run it locally

You need Node 22.12+ and Postgres 16+ with PostGIS (Docker, or your own).

```bash
docker compose up -d                       # Postgres + PostGIS on :5432
cp apps/web/.env.example apps/web/.env
cd apps/web && npm ci && npm run db:setup  # migrations + sample data
npm run dev                                # http://localhost:3000
```

Every external service (Google sign-in, SMS OTP, payments, notifications) runs as a local mock when its key is empty, so no accounts or keys are needed. In dev, "Continue with Google" signs in a sample user, OTP codes and password-reset links print in the server log, and seeded accounts (`ramesh@khetirental.test`, `sunil@khetirental.test`, …) use the password `kheti-demo-2026`.

Using your own Postgres instead of Docker: the tests clone throwaway databases from `template_postgis`, which the Docker image creates. Create it once as a superuser: `createdb -T template0 template_postgis && psql -d template_postgis -c 'CREATE EXTENSION postgis; CREATE EXTENSION btree_gist; ALTER DATABASE template_postgis IS_TEMPLATE true'`.

## Project map

| Path | What it is |
|---|---|
| `apps/web/` | The website (Next.js App Router, TypeScript, Tailwind). This is the product. |
| `compose.yaml` | Local Postgres + PostGIS (and Redis for the showcase). |
| `design/` | Approved UI mockups (reference only; see `UI-SPEC.md` §0). |
| `docs/` | Agent docs and the docs link checker. |
| `showcase/` | Engineering portfolio: Go services, contracts, analytics, PRD, ADRs and the risk audit. Not on the website's request path. See [`showcase/README.md`](showcase/README.md). |
| `GLOSSARY.md` | The terms used across the product and code. |

## Checks

```bash
./test-all.sh            # website + showcase + repo checks
```

In `apps/web`: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`.

## Deploy

The website deploys to Vercel with `apps/web` as the root directory. `.github/workflows/deploy-portal.yml` deploys on pushes to `main` once the `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` secrets exist.
