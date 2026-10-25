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
