// Every number the portal states about the project, with the repo file it
// comes from. Pages read from here so a claim can't drift from its source.

export interface Evidence {
  label: string;
  value: string;
  note: string;
  source: string; // path from the repo root
}

export const EVIDENCE = {
  vus: {
    label: "Concurrent virtual users",
    value: "5,000",
    note: "k6 harvest-surge ramp, 0.00 % failed requests",
    source: "showcase/tests/load/k6/full_flow.js",
  },
  p99: {
    label: "H3 search latency, p99",
    value: "2.91 ms",
    note: "p95 0.66 ms, ~4,000 req/s, single host",
    source: "showcase/ARCHITECTURE.md",
  },
  audit: {
    label: "Risk-audit tests passing",
    value: "20 / 20",
    note: "every audit finding reproduced by a failing test, then fixed",
    source: "showcase/docs/audit/phase1-invariant-audit.md",
  },
  savings: {
    label: "Farmer saving vs a broker",
    value: "27.5 %",
    note: "if brokers add 38 % (an unvalidated assumption)",
    source: "showcase/docs/PRD.md",
  },
} satisfies Record<string, Evidence>;

// p95 of /machines/near at 5,000 VUs across the design iterations, in the
// order they were made (showcase/tests/load/k6/full_flow.js). Runs 2 and 3 share a
// load profile, so 728 → 190 ms isolates the index change.
export const LOAD_TEST_RUNS = [
  { run: "First run: every machine in the ring returned, no think time", p95Ms: 1770 },
  { run: "Top-20 limit, renter think time", p95Ms: 728 },
  { run: "One Redis hash per H3 cell, one round trip", p95Ms: 190 },
  { run: "Faster parsing, realistic machine density", p95Ms: 0.66 },
] as const;

export const RESUME_BULLETS = {
  trackA: [
    "Cut p95 search latency 74% (728 ms to 190 ms) at 5,000 concurrent users, reaching 2.91 ms p99 with 0% errors at realistic machine density, by storing each Uber H3 Res-8 cell as one Redis hash and fetching the k-ring in a single pipelined round trip in Go",
    "Eliminated stale-write double bookings under simulated GC pauses, verified by 20 adversarial integration tests on real Redis and Postgres including 50 concurrent racers, by redesigning Redlock with quorum-minted fencing tokens, owner-checked lease heartbeats and a fenced SQL predicate",
    "Engineered exactly-once saga compensation, with 25 concurrent redeliveries releasing inventory and voiding escrow once against Postgres, by committing each state change with its outbox event in one transaction behind an idempotent fenced transition",
  ],
  trackB: [
    "Authored the KhetiRental v2.0 product spec (PRD, OpenAPI 3.1 contract, Kafka event schemas, 4 ADRs) and kept 4 copies of the booking state model identical by adding a CI check across contract, events, Go and SQL",
    "Designed a 3-stage milestone escrow with 9 dispute rules whose ledger conserved every paisa across 2,000 randomized multi-actor test sequences, and drove 22 risk-audit remediations for 19 vulnerabilities (2 critical, 13 fixed in code) by turning each finding into a failing test first",
    "Built a dynamic depreciation pricing model showing owner payback falling from 4.3 to 1.7 years as utilization rises from 250 to 620 hours a year, and corrected the farmer savings claim from 38% to 27.5% by deriving it from the broker markup",
  ],
} as const;
