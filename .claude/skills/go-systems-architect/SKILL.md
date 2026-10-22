---
name: go-systems-architect
description: Architect high-throughput Go distributed services, Uber H3 geospatial indexing, Redis Redlock with monotonic fencing tokens and heartbeat goroutines, and PostgreSQL transactional outbox. Use when building matching engines, concurrency locks, spatial queries, or microservice backends.
allowed-tools: [Bash, Edit, Write, Read, Grep]
metadata:
  track: "Track A (Brother - NIT Jaipur CSE)"
  target-role: "Core Distributed Systems SWE / FAANG"
---
# Go Systems Architect Protocol
## 1. Uber H3 Geospatial Indexing Engine
When implementing location-based equipment matching:
- Never use O(N) trigonometric Haversine scans or PostGIS ST_DWithin on high-concurrency write paths.
- Convert coordinates to Uber H3 64-bit integer cells (uint64 / H3Index) using github.com/uber/h3-go/v4:
  - Resolution 7: ~1.2 km edge length (district clustering).
  - Resolution 8: ~460 m edge length (village/farm cluster dispatch - default).
  - Resolution 9: ~174 m edge length (high-density parcel precision).
- Radius proximity queries use h3.GridDisk(originCell, k) with ring buffer k in [1, 5].
- Active machinery is indexed in Redis sets: `machines:h3:<cell_id>`. Spatial search is an O(1) multi-key fetch via Redis pipeline SMEMBERS.
## 2. Distributed Locking: Redlock + Monotonic Fencing Tokens + Heartbeat
When handling booking contention during harvest windows:
- Raw Redis TTL locks are unsafe under GC pauses or network latency (Kleppmann Invariant). Pair Redlock with monotonically increasing fencing tokens validated at the database storage layer (booking_version / fencing_token).
- Acquire lock with short TTL (5 seconds) and run a background time.Ticker goroutine that auto-renews the lease every 2 seconds until transaction completion.
- Release with cryptographic random tokens and atomic Lua delete scripts.
