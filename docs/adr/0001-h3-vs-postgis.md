# ADR-0001: Uber H3 hexagonal indexing vs PostGIS for spatial matching

- **Status:** Accepted
- **Decider:** Lead 1 (systems) — ratified by Lead 2
- **Date:** 2026-06

## Context
The matching engine must answer "which machines are within radius R of point P,
ranked by distance / HP / owner reputation" at 5,000 concurrent renters with
p99 < 25 ms. The two candidate designs:

- **PostGIS** `ST_DWithin` on a Postgres geog point column — exact, but each
  query is a B-tree/GiST scan that degrades under high concurrency on the same
  write-heavy cluster.
- **Uber H3** hex cells in Redis — O(1) multi-key `HGETALL` pipeline over a k-ring (one hash per cell, ranking attributes inline).

## Decision
Use **H3 at Res 7/8/9** with the spatial index in Redis (`machines:h3:<cell>`),
and keep Postgres only as the ACID booking-of-record. No PostGIS on the hot
read path.

## Rationale
- H3 gives a **uniform, integer-keyed, tileable** index: a radius query is a
  fixed number of keys (k-ring ≤ 5 → ≤ 37 keys), so the read is a single
  Redis pipeline, independent of how many machines exist total — the core
  property that lets p99 stay flat at 5k VUs.
- A GiST/PostGIS scan cost grows with the dataset and with concurrent
  write-lock contention on the same Postgres cluster that owns the outbox.
- H3 cells nest (k-ring is a superset), so we can serve district-level
  (Res7) and village-level (Res8) queries from the same index.
- Fallback Haversine is kept only for *scoring* distance (ranker), never for
  *candidate generation*.

## Consequences
- We must keep the per-cell Redis hashes in sync with machine location updates (done by the
  matching engine's `Index`/`Unindex`).
- Approximate radius: a k-ring is a hex tile ring, not a perfect circle; the
  k derived from `radius_km / edge_length` over-covers by up to one cell.
  Accepted because the ranker then filters by true distance.
- No sub-meter accuracy is needed for tractor dispatch — village-scale
  (~460 m at Res8) is the correct granularity.
