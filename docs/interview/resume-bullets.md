# Resume bullets — KhetiRental v2.0

Copy-ready bullets in Google X-Y-Z form (accomplished X, measured by Y, by
doing Z). Every number comes from this repository; the same text is shown on
the dossier pages and a test keeps the two identical
(`apps/web/lib/evidence.ts`).

---

## Track A — Tarun Konde (distributed systems)

**Project line:** KhetiRental v2.0 — agricultural machinery marketplace with milestone escrow | Go, Redis, PostgreSQL, Uber H3, Kafka (outbox), k6

- Cut p95 search latency 74% (728 ms to 190 ms) at 5,000 concurrent users, reaching 2.91 ms p99 with 0% errors at realistic machine density, by storing each Uber H3 Res-8 cell as one Redis hash and fetching the k-ring in a single pipelined round trip in Go
- Eliminated stale-write double bookings under simulated GC pauses, verified by 20 adversarial integration tests on real Redis and Postgres including 50 concurrent racers, by redesigning Redlock with quorum-minted fencing tokens, owner-checked lease heartbeats and a fenced SQL predicate
- Engineered exactly-once saga compensation, with 25 concurrent redeliveries releasing inventory and voiding escrow once against Postgres, by committing each state change with its outbox event in one transaction behind an idempotent fenced transition

**Skills to list:** Go, Redis (Redlock, Lua), PostgreSQL (pgx, transactions), Uber H3, saga pattern, transactional outbox, CRDTs, WebSockets, k6, GitHub Actions, TDD with integration and adversarial concurrency tests.

**30-second pitch:** "I built the matching and booking backend for a tractor-rental marketplace. Search reads a fixed set of H3 cells from Redis, so it stays under 3 ms at p99 with 5,000 concurrent users. The harder part was correctness: an audit showed our lock fencing was backwards, so a paused process could overwrite a newer booking. I rebuilt it so tokens are minted after the lock is won and the database rejects stale writes, and proved it with 20 failing-then-passing tests against real Redis and Postgres."

**Be ready to explain:** why fencing tokens are needed even with Redlock; why the token is max+1 over the quorum; why state and event commit in one transaction; what the 728 → 190 ms change was and why runs 2 and 3 are comparable.

---

## Track B — Vedant Konde (product, risk and pricing)

**Project line:** KhetiRental v2.0 — agricultural machinery marketplace with milestone escrow | PRD, OpenAPI 3.1, ADRs, escrow and dispute design, pricing model

- Authored the KhetiRental v2.0 product spec (PRD, OpenAPI 3.1 contract, Kafka event schemas, 4 ADRs) and kept 4 copies of the booking state model identical by adding a CI check across contract, events, Go and SQL
- Designed a 3-stage milestone escrow with 9 dispute rules whose ledger conserved every paisa across 2,000 randomized multi-actor test sequences, and drove 22 risk-audit remediations for 19 vulnerabilities (2 critical, 13 fixed in code) by turning each finding into a failing test first
- Built a dynamic depreciation pricing model showing owner payback falling from 4.3 to 1.7 years as utilization rises from 250 to 620 hours a year, and corrected the farmer savings claim from 38% to 27.5% by deriving it from the broker markup

**Skills to list:** product requirements and API contracts (OpenAPI 3.1, JSON Schema), architecture decision records, marketplace unit economics, escrow and dispute-rule design, risk auditing, Python modelling, property-based testing.

**30-second pitch:** "I designed the product and risk side of a tractor-rental marketplace for small farms. Money is held in a three-stage escrow and only moves when handover, use and return are verified, with nine dispute rules for what goes wrong. I built the pricing model from cost drivers and used it to correct our own claims: the farmer saving is 27.5 %, not 38 %, and once owner costs and droughts are included, payback is 9.0 → 3.3 years, so an owner needs about 422 rented hours a year to repay a tractor loan."

**Be ready to explain:** the deposit floor and why it hurts short jobs (docs/interview/phase10-grilling.md, Q2); why the take-rate matters less than utilisation; what is assumption vs measured (PRD §1).

---

Model answers to the hardest interview questions: [phase10-grilling.md](phase10-grilling.md).
