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

Every external service (Google sign-in, SMS OTP, payments, notifications) runs as a local mock when its key is empty, so no accounts or keys are needed. In dev, "Continue with Google" signs in a sample user, OTP codes and password-reset links print in the server log, and seeded accounts (`ramesh@khetirental.test` owner, `sunil@khetirental.test` renter, `admin@khetirental.test` admin, …) use the password `kheti-demo-2026`.

Using your own Postgres instead of Docker: the tests clone throwaway databases from `template_postgis`, which the Docker image creates. Create it once as a superuser: `createdb -T template0 template_postgis && psql -d template_postgis -c 'CREATE EXTENSION postgis; CREATE EXTENSION btree_gist; ALTER DATABASE template_postgis IS_TEMPLATE true'`.

### Real sign-in on a deployment (all free)

With no keys, a deployed site offers email + password only: Mobile OTP needs an SMS provider (none is built in, so the Mobile method is hidden and the OTP API answers 503), and Google is hidden without its keys. Every account, whichever way it signs in, is a row in the `users` table.

**Password-reset emails with Gmail SMTP**

1. Turn on 2-Step Verification for the Google account that will send the mail.
2. Open <https://myaccount.google.com/apppasswords>, create an app password named "KhetiRental" and copy the 16 letters.
3. Set `SMTP_URL=smtps://you%40gmail.com:the-16-letters@smtp.gmail.com:465` (`@` in the address written as `%40`), `MAIL_FROM="KhetiRental <you@gmail.com>"` and `SITE_URL=https://your-domain`. Links in emails always use `SITE_URL`, never the request's Host header.

**Sign in with Google**

1. In <https://console.cloud.google.com/>, create a project, then APIs & Services, OAuth consent screen (External, add your email as a test user while testing).
2. Credentials, Create credentials, OAuth client ID, type Web application.
3. Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google` and `https://your-domain/api/auth/callback/google`.
4. Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` to the client ID and secret. A new Google user gets a `users` row with name, email, photo and the renter role. Someone who already has an email + password account with the same address is not merged automatically (that would let a person who signed up with your address take over your Google login); they see the sign-in error and use their password.

## Project map

| Path           | What it is                                                                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/`    | The website (Next.js App Router, TypeScript, Tailwind). This is the product.                                                                                               |
| `compose.yaml` | Local Postgres + PostGIS (and Redis for the showcase).                                                                                                                     |
| `design/`      | Approved UI mockups (reference only; see `UI-SPEC.md` §0).                                                                                                                 |
| `docs/`        | Agent docs and the docs link checker.                                                                                                                                      |
| `showcase/`    | Engineering portfolio: Go services, contracts, analytics, PRD, ADRs and the risk audit. Not on the website's request path. See [`showcase/README.md`](showcase/README.md). |
| `GLOSSARY.md`  | The terms used across the product and code.                                                                                                                                |

## Checks

```bash
./test-all.sh            # website + showcase + repo checks
```

In `apps/web`: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` (build first: the e2e run starts the production build).

Quality gates (after `npm run build`; Lighthouse needs the database from `db:setup`):

```bash
npm run test:budget      # first-load JavaScript per page, gzipped, measured in a real browser
npm run lighthouse       # Lighthouse CI: mobile, simulated Slow 4G, 4x CPU (LH_RUNS=1 for a quick look)
npm run test:visual      # screenshot snapshots at 390 / 768 / 1280 (test:visual:update after an intended change)
```

Hindi and Marathi text that is not translated yet is shown in English; the keys still marked `TODO-translate:` in `apps/web/messages/hi.json` and `mr.json` are the translators' work list.

## Deploy

Free hosting: Vercel for the site, Neon for Postgres + PostGIS. Uploaded photos are stored in the database, so no extra storage service is needed.

1. Neon: create a project (region Mumbai), copy the direct (non-pooled) connection string, then load the tables and sample data: `DATABASE_URL="…" npm --prefix apps/web run db:setup`.
2. Vercel: import the GitHub repo with Root Directory `apps/web`; add `DATABASE_URL` and `AUTH_SECRET` (`openssl rand -base64 32`); deploy; then add `SITE_URL` (the site's https address) and redeploy. Every push to `main` deploys again.
3. Optional: `SMTP_URL`/`MAIL_FROM` for reset emails, `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` for Google sign-in (see below). Run `db:migrate` against Neon after pulling new migrations.

`.github/workflows/deploy-portal.yml` is an alternative to Vercel's GitHub integration: it deploys only when the `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` secrets exist.
