# Phase 1 Invariant Audit — KhetiRental v2.0

- **Date:** 2026-10-24
- **Scope:** `showcase/contracts/openapi.yaml`, `showcase/contracts/escrow-state-machine.md`, `showcase/docs/adr/0002-kafka-saga-vs-2pc.md`, `showcase/go/booking-orchestrator/internal/{redlock,saga,events}`, `showcase/deploy/sql/*.sql`, `showcase/go/telemetry-gateway/internal/{geo,ws}`, `showcase/docs/PRD.md` §6.
- **Method:** every FAIL is backed by a RED test named `TestAudit_*` that fails today and passes once the remediation lands. Integration tests run against real Redis (127.0.0.1:6390, DBs 14-15) and real PostgreSQL 17 (127.0.0.1:5440, throwaway database with `showcase/deploy/sql/*.sql` applied, dropped afterwards). No non-test source was changed. Timings in tests are scaled (TTL 300 ms / heartbeat 100 ms stand in for 5 s / 2 s; a 600 ms pause stands in for a 10 s GC pause); they are test parameters, not production measurements.
- **Status legend:** PASS = verified by a passing test; FAIL = reproduced by a RED test; PARTIAL = correct in part; GAP = required behaviour has no code or rule at all, so there is nothing to execute a test against.

Repo-wide observation: `showcase/go/booking-orchestrator/cmd/orchestrator/` is empty. Nothing in production code calls `redlock.Acquire`, `Lock.Release` or `saga.NewOrchestrator`, and nothing calls `geo.Breach` / `geo.Tamper`. Every invariant below is a library-level property; none is enforced end-to-end yet.

---

## 1. Invariant Pass/Fail Matrix

### Invariant 1 — Distributed locking and fencing tokens

| Sub-check | Status | Evidence | Test |
|---|---|---|---|
| GC pause: B acquires after A's lease lapses, with a higher token | PASS | `redlock.go:80-102` | `TestAudit_Fencing_GCPauseStaleWriteRejected` (passes up to the DB step) |
| GC pause: A's stale write rejected at the DB, B's write stands | **FAIL** | `fenced_store.go:46-52` (`WHERE fencing_token = $3`). Measured: B (token 2) rows=0, A (token 1, stale) rows=1, final state = A's | `TestAudit_Fencing_GCPauseStaleWriteRejected` |
| Same holder can make a second transition | **FAIL** | `fenced_store.go:49` (`fencing_token + 1`) then `:52` equality. Measured: first rows=1, second rows=0. The saga transitions 3x per lock (`saga.go:142,153,161`) | `TestAudit_Fencing_SameHolderSecondTransition` |
| Concurrent stale writers after the newest | **FAIL** | `fenced_store.go:46-52`. 20 holders; the newest (token 20) rows=0; 1 to 5 stale writes accepted per run (10 runs measured) | `TestAudit_Concurrency_StaleTokensArriveAfterNewest` |
| Heartbeat renews only an owned lease | **FAIL** | `redlock.go:157-161` plain `EXPIRE`, error discarded. Measured: B's 400 ms lease still alive after 1 s | `TestAudit_Heartbeat_DoesNotExtendLostLock` |
| Fencing counter survives node-0 loss (monotonic) | **FAIL** | `redlock.go:80-81` INCR only on `Nodes[0]`. Measured after node-0 reset: A=1, B=1 | `TestAudit_Fencing_MonotonicAfterNode0Reset` |
| Acquire tolerates a minority node outage | **FAIL** | `redlock.go:81-84` returns before the quorum loop. Measured: 2/3 healthy, Acquire fails with `connection refused` | `TestAudit_Fencing_Node0DownStillAcquires` |
| Validity time (TTL minus elapsed minus drift) checked after quorum | **FAIL** | `redlock.go:97-119` has no elapsed-time check. Measured: lock returned after 605 ms against a 300 ms TTL | `TestAudit_Redlock_ValidityTimeCheckedAfterQuorum` |
| Token minted after the lock is won (successor token > predecessor token) | **FAIL** | `redlock.go:80` INCR runs before `:90-96` SET NX. Deterministic interleaving: successor X holds token 1, predecessor Y had 2 | `TestAudit_Concurrency_TokenMintedBeforeLockInverts` |
| 50 racers: one holder at any instant, increasing tokens | PASS | 50 goroutines on real Redis; 0 failures in 60 runs. The inversion above needs a stall between INCR and SET NX, which this race did not produce | `TestAudit_Concurrency_FiftyRacersOneHolder` |
| Release after lapse deletes only its own key | PASS | `redlock.go:167-177` Lua guarded delete | existing `TestReleaseOnlyDeletesOwnLock` |
| Holder learns it lost the lock | GAP | `redlock.go:160` discards the error; `Lock` has no lost/expired signal | — |

### Invariant 2 — Kafka saga compensating rollback (escrow auth > 30 s)

Transition trace for a timeout today: `Reserve` → `INVENTORY_RESERVED` (+event) → `Authorize` ctx deadline → `compensate`: `inventory.Release` → `FAILED_PAYMENT_RELEASED` (+event). Escrow is never voided, and the rows-affected value and emit errors are discarded at every step.

| Sub-check | Status | Evidence | Test |
|---|---|---|---|
| Timeout ends in `FAILED_PAYMENT_RELEASED` with inventory released | PASS | `saga.go:166-167,179-188` | existing `TestEscrowTimeoutCompensates` |
| Escrow authorisation voided on timeout (`EscrowAuthorizer.Compensate`) | **FAIL** | `saga.go:179-189` never calls `o.escrow.Compensate`. The existing fake records `escrowCompensated` (`saga_test.go:43`), but no existing test asserts it | `TestAudit_Saga_TimeoutVoidsEscrowAuthorization` |
| Provider approval after the SLA does not move the booking forward | **FAIL** | `saga.go:151-152` checks `err == nil` before the deadline. Measured: final state `DISPATCHED`, escrow not voided | `TestAudit_Saga_LateApprovalAfterSLACompensates` |
| 0 rows affected (lost lock) aborts the saga | **FAIL** | `saga.go:139,142,153,161,184` discard rows. `ApplyTransition` (`fenced_store.go:59`) is never called. Measured: err=nil, dispatched, 3 events | `TestAudit_Saga_StaleFencingZeroRowsAborts` |
| Compensation idempotent under redelivery | **FAIL** | `saga.go:179-188` releases before any state guard. Measured: Release 2x, 2 events | `TestAudit_Saga_CompensationIdempotent` |
| Compensation idempotent under N concurrent redeliveries | **FAIL** | same. Measured with N=25: Release 25x, 25 events | `TestAudit_Concurrency_CompensationRedeliveredConcurrently` |
| Outbox write in the same DB tx as the state change (no dual write) | **FAIL** | `saga.go:191-193` comment claims the same tx, but `TransitionState` (`fenced_store.go:31`) and `Producer.Produce` (`saga.go:83`) are independent calls | `TestAudit_Saga_OutboxWriteFailureAbortsTransition` |
| Emit errors surfaced | **FAIL** | `saga.go:145,156,164,187` `_ = o.emit(...)`; also `json.Marshal` error dropped at `:195`. Measured: 3 states committed, 0 events, err=nil | `TestAudit_Saga_OutboxWriteFailureAbortsTransition` |
| Inventory release failure retried | PARTIAL | `saga.go:181-183` returns an error and leaves the booking in `INVENTORY_RESERVED` with no retry or outbox record | — |
| Redlock released on every path (no ghost lock) | GAP | The saga only holds a `Fencer` (`saga.go:104-106,111`). No caller owns Acquire/Release (`cmd/orchestrator/` is empty). A crashed holder relies on TTL expiry, which the heartbeat bug above can defeat | — |
| Consumer inbox / idempotency check | GAP | `events/outbox.go:27-29` interface only, no implementation. The schema PK exists (`002_outbox_inbox.sql:19-24`) | — |
| Outbox publisher | GAP | `events/outbox.go:18-22` interface only. `Poller` (`:32-45`) has no drain loop | — |

### Invariant 3 — Escrow dispute rules D-01..D-07

| Sub-check | Status | Evidence | Test |
|---|---|---|---|
| D-01 distance measured as > 500 m outside the parcel edge | **FAIL** | `anomaly.go:41-45` uses `RadiusM` as the breach distance. A 300 m parcel breaches at ~256 m outside the edge | `TestAudit_D01_BreachMeasuredFromParcelEdge` |
| D-01 T_grace 60 s | GAP | `anomaly.go:30-46` has no timestamp or state. PRD §6 (`PRD.md:108`) admits it | — (see next row) |
| D-01 over replayed/reordered multi-device telemetry, spoofed jump and 90 s excursion | **FAIL** (convergence PASS) | `ws/sync.go` keeps only the LWW last-known value per key. Measured: converged correctly, but 0 off-parcel samples are retained, so a 90 s excursion during a 2G blackout is invisible and a 15 s spoof cannot be told apart from it | `TestAudit_Concurrency_TelemetryReplaySpoofedTrack` |
| GPS spoof / teleport (implausible velocity) detection | GAP | No velocity, HDOP or satellite-count check anywhere. `003_telemetry.sql:13` has no `GPS_SPOOF` flag | — |
| Gateway calls Breach/Tamper | GAP | No production caller (grep). `anomaly_flags` are never written | — |
| D-02 exactly 10 % is not tamper | **FAIL** | `anomaly.go:58` float ratio: 1.1/1.0 gives 0.10000000000000009 > 0.10 | `TestAudit_D02_ExactTenPercentBoundary` |
| D-02 meter rolled back > 10 % flagged | PASS | `anomaly.go:54-57` takes the absolute value | existing `TestTamper` |
| D-02 bypass via `GPSTravelH = 0` | GAP (by design today) | `anomaly.go:51-53` returns false. Spoofing the GPS stationary hides any ECU reading. Stationary PTO work (threshing, pumping) also legitimately has 0 travel, so D-02 is ill-posed for it | — |
| ECU monotonic across samples (rollback within the 10 % band) | GAP | No per-sample monotonic check. `003_telemetry.sql:9` only checks `>= 0`. A rollback of up to 10 % passes D-02 and lowers ΔH for D-03 | — |
| Dispute state persistable/returnable | **FAIL** | `openapi.yaml:100` returns 409 "dispute open", but `DISPUTE_OPEN` is absent from `openapi.yaml:154-163` and `001_bookings.sql:11-14` | `TestAudit_Contract_DisputeOpenStateRepresentable` |
| Deposit definition consistent | **FAIL** | `escrow-state-machine.md:93` "deposit = 115 % of base rental" vs `:51,137` 15 % security deposit | `TestAudit_Contract_DepositDefinitionConsistent` |
| Geofence radius consistent | **FAIL** | `escrow-state-machine.md:35` "5 km radius" vs D-01 `:122` 500 m | `TestAudit_Contract_GeofenceRadiusConsistent` |
| Mid-lease breakdown rule | GAP | `PRD.md:109`, no D-08 | — |
| Weather delay rule | GAP | `PRD.md:110`, no pause/extend policy | — |
| D-06 no-show vs 2G blackout | GAP (spec defect) | `escrow-state-machine.md:127`: "no GPS entry within 24 h" cannot tell "never arrived" from "arrived, offline". Auto-refund then fires while the machine is working | — |
| D-07 timing | GAP (spec defect) | `:106` checks KYC at P1 (handover), but `:128` action is `BLOCK_LISTING`. By P1 the renter has paid and the machine is on site; a listing-time check is missing | — |

**Totals:** 20 RED tests (17 in booking-orchestrator, 3 in telemetry-gateway), all failing for the reason stated. 1 new concurrency test passes (`FiftyRacersOneHolder`).

---

## 2. Edge-Case Vulnerabilities Identified

| # | Severity | Failure / exploit scenario | Renter | Owner | Platform |
|---|---|---|---|---|---|
| V1 | **Critical** | **Fencing is inverted.** Equality compare plus self-increment means the row accepts only the token it was created with. A GC-paused holder A resumes and overwrites the state while the legitimate holder B is rejected (reproduced against Postgres). | A booking is moved by a dead process (e.g. to `FAILED_INVENTORY` after B confirmed). | The machine is double-committed, or released while it is on the road. | FR-3 is violated; the core safety claim of ADR-0002 does not hold. |
| V2 | **Critical** | **Every happy-path booking fails at its second transition** with the real SQL (rows=0 on `ESCROW_AUTHORIZED`). This is masked because the saga ignores rows-affected. | Escrow authorised; the booking silently reports progress the DB never stored. | Dispatch notification is sent for a booking whose DB row is stuck. | DB and event stream diverge on every booking. |
| V3 | **High** | **Ghost escrow hold.** On SLA timeout, inventory is released but the authorisation is not voided. A late provider approval holds the renter's funds (100 % + 15 %) with no booking. | Funds blocked; support ticket and chargeback. | — | Payment-provider disputes and trust loss. |
| V4 | **High** | **Late approval proceeds.** A provider that ignores context cancellation and returns success after 30 s moves the booking to `DISPATCHED`, defeating FR-4. | Billed beyond the SLA promise. | The machine may already be released to another renter (race with V1). | SLA is unenforceable. |
| V5 | **High** | **Heartbeat resurrects lost locks.** After A loses the lease and B acquires, A's heartbeat keeps extending B's key. When B finishes, A's renewals keep the key alive until A exits, so the machine stays locked. With a crashed B, the lock stays up as long as A runs. | Cannot book an idle machine. | Lost utilisation. | Liveness bug; it hides behind "machine not available" 409s. |
| V6 | **High** | **Fencing single point of failure.** Node-0 outage blocks all bookings even with quorum. Node-0 failover without persistence resets the counter and reissues old tokens, which re-opens V1 even after the SQL fix. | Bookings fail. | — | Availability is that of one Redis node, not the Redlock majority. |
| V7 | **High** | **Dual write and swallowed emits.** State commits while the event is lost (measured: 3 states, 0 events, err=nil). Downstream escrow/dispatch never learns of `FAILED_PAYMENT_RELEASED`. | Refund never triggered. | Dispatch sent for a cancelled booking. | Inconsistent ledger; FR-5 is violated. |
| V8 | **High** | **Non-idempotent compensation.** At-least-once redelivery runs Release N times (measured 25/25). If `Release` is not idempotent downstream, inventory counts go negative or another renter's hold is released. | Another renter's confirmed hold may be dropped. | Double-booked machine. | ADR-0002 consequence ("compensation must be idempotent") is unmet. |
| V9 | **High** | **D-01 blind during 2G blackout.** Only last-known position survives CRDT convergence. A renter drives off-parcel for 90 s or more while offline and returns before reconnecting; replay converges to "inside" and no breach fires. The same structure means a spoofed GPS feed is never detected. | — | Asset taken off-parcel with no deposit freeze. | D-01 is unenforceable, and the evidence for disputes is lost. |
| V10 | **Medium** | **D-01 false positives on explicit parcels.** A breach fires at `RadiusM` from the centroid, not 500 m past the edge, so any machine at a field boundary trips it. | Deposit frozen and forfeited (`escrow-state-machine.md:140`) for working the headland. | — | False-dispute volume works against the < 5 % dispute-rate target. |
| V11 | **Medium** | **Validity time not checked.** Slow Redis (measured 605 ms against a 300 ms TTL) returns a lock whose first-node lease has already expired, so two holders can coexist. | — | Double booking. | Redlock's safety precondition is violated. |
| V12 | **Medium** | **Token minted before the lock.** A stalled acquirer becomes the next holder with an older token (deterministic test). With a correct `<` fence its writes are all rejected (safe but wasted). With today's SQL it compounds V1. | — | — | Requires the remediation-order fix. |
| V13 | **Medium** | **D-02 boundary and bypasses.** Exactly 10 % flags at small magnitudes (float). GPS=0 disables tamper entirely. Meter rollback ≤ 10 % is undetectable and under-bills D-03. | False tamper flags on short rentals. | Under-billing through rollback or spoofed stationary GPS. | Rule is non-deterministic around the threshold. |
| V14 | **Medium** | **D-06 false no-show.** A machine on site but offline for 24 h in a 2G area triggers `AUTO_REFUND` and cancel. | Gets a free rental if it disputes later. | Loses the full rental for work done. | Wrong-direction payout. |
| V15 | **Medium** | **Disputes not representable.** `DISPUTE_OPEN` is absent from the API enum and the SQL CHECK, so a frozen deposit cannot be persisted, and settle's 409 has no state to read. | — | — | D-01..D-05 actions have nowhere to land. |
| V16 | **Medium** | **Deposit 115 % vs 15 %.** The HOLD invariant and the disposition matrix disagree. Pre-auth is either 215 % or 115 % of base rental. | Over-authorisation blocks working capital. | — | Pricing and escrow contract ambiguity. |
| V17 | **Low** | **Geofence 5 km vs 500 m.** Contradictory radius in the milestone table vs D-01. | — | — | Spec ambiguity. |
| V18 | **Low** | **D-07 at P1 not listing.** KYC mismatch is found only at handover, after the renter has paid and the machine has travelled. | Wasted trip. | Fraudulent lister reaches handover. | Late fraud detection. |
| V19 | **Low** | **No breakdown/weather rule.** No state or billing pause exists, so each case is a manual dispute. | Pays for idle hours. | Bears ambiguous repair cost. | Lowers auto-resolution rate (≥ 70 % target). |

---

## 3. Concrete Remediation Guidelines for PRD v2.0

1. **[Track A] Fix the fencing predicate.** Replace `TransitionSQL` with `UPDATE bookings SET state=$1, fencing_token=$3, updated_at=now() WHERE booking_id=$2 AND fencing_token <= $3`. Same-holder writes pass; any write with a token below the stored one gets 0 rows. Also add `CHECK` via trigger that `fencing_token` never decreases. Greens: `GCPauseStaleWriteRejected`, `SameHolderSecondTransition`, `Concurrency_StaleTokensArriveAfterNewest`.
2. **[Track A] Enforce rows-affected.** Every `TransitionState` call in `saga.go` must go through `ApplyTransition`. On `ErrStaleFencing`, stop all side effects: no dispatch, no emit, and return the wrapped error. Greens: `Saga_StaleFencingZeroRowsAborts`.
3. **[Track A] Outbox in the same transaction.** Change `FencedBookingStore.TransitionState` to take the `OutboxEvent` and execute the `UPDATE` plus `INSERT INTO outbox_events` in one `pgx.Tx`. Delete the direct `Producer` call from the saga. Propagate marshal and insert errors. Greens: `Saga_OutboxWriteFailureAbortsTransition`.
4. **[Track A] Compensation = guarded transition first, side effects second.** Order: (a) `UPDATE ... SET state='FAILED_PAYMENT_RELEASED' WHERE state IN ('INVENTORY_RESERVED','ESCROW_AUTHORIZED') AND fencing_token <= $tok`, plus the outbox row in the same tx. (b) If rows=0, return nil (already compensated). (c) The `inventory.Release` and `escrow.Compensate` consumers must be idempotent by `(booking_id, event_id)` through `processed_inbox_messages`. Greens: `Saga_CompensationIdempotent`, `Concurrency_CompensationRedeliveredConcurrently`.
5. **[Track A] Void escrow on every compensating path.** `compensate()` must call `escrow.Compensate(bookingID)` (an idempotent void using the provider idempotency key = booking_id). After the SLA, any `Authorize` result, including success, routes to compensation: check `authCtx.Err() != nil` before `err == nil`. Greens: `Saga_TimeoutVoidsEscrowAuthorization`, `Saga_LateApprovalAfterSLACompensates`.
6. **[Track A] Owner-checked heartbeat.** Replace `EXPIRE` with Lua `if GET==token then PEXPIRE` and count successes. If fewer than quorum nodes renew, cancel the holder's context and expose `Lock.Lost() <-chan struct{}` so the saga aborts. Greens: `Heartbeat_DoesNotExtendLostLock`.
7. **[Track A] Validity time.** Record `start` before the SET NX loop. After quorum, `validity = TTL - elapsed - (TTL*0.01 + 2ms)`. If `validity <= 0`, release all and fail. Greens: `Redlock_ValidityTimeCheckedAfterQuorum`.
8. **[Track A] Mint the fencing token after winning, from a durable source.** Move token minting after quorum is acquired. Source it from Postgres (`SELECT nextval('booking_fencing_seq')`, which is durable and the same store that validates it) instead of `INCR` on `Nodes[0]`. This removes the single point of failure and the counter-reset regression. Greens: `Fencing_MonotonicAfterNode0Reset`, `Fencing_Node0DownStillAcquires`, `Concurrency_TokenMintedBeforeLockInverts`.
9. **[Track A] Own the lock lifecycle.** Implement `cmd/orchestrator` with `l, err := redlock.Acquire(...); defer l.Release(ctx)` around `Start`, so Release runs on success, error and panic paths. Add a test that injects a panic in `Authorize`.
10. **[Track A] Keep the telemetry track, evaluate D-01 with time.** Store each sample under a per-timestamp key (or append to `telemetry_points`, PK dedup already exists). Evaluate D-01 as "consecutive samples outside for ≥ T_grace = 60 s by device timestamp" after replay, not on the last-known value. Greens: `Concurrency_TelemetryReplaySpoofedTrack`.
11. **[Track A] Measure D-01 from the edge.** `Breach` = `haversine(centroid, point) - RadiusM > GeofenceRadiusM`. Greens: `D01_BreachMeasuredFromParcelEdge`. Update the existing `TestBreach` "1 km parcel" case comment accordingly (it still holds).
12. **[Track A] D-02 deterministic boundary.** Compare in integer deci-hours (`ECU*10`, `GPS*10` rounded) or use `diff*10 > base` with an epsilon of 1e-9. Greens: `D02_ExactTenPercentBoundary`.
13. **[Track B] Add `DISPUTE_OPEN` (and `DEPOSIT_FROZEN`) to the booking state enum** in `openapi.yaml`, the `001_bookings.sql` CHECK, and saga constants. Define allowed transitions from `TELEMATICS_ACTIVE` and `POST_RETURN_AUDIT` only. Greens: `Contract_DisputeOpenStateRepresentable`.
14. **[Track B] One deposit definition.** Pre-auth = 100 % base rental + security deposit of 15 % of base rental (= 115 % of base rental *total pre-auth*). Rewrite `escrow-state-machine.md:93` as "pre-auth = 115 % of base rental (100 % rental + 15 % deposit)". Greens: `Contract_DepositDefinitionConsistent` (adjust the string the test pins once reworded).
15. **[Track B] One geofence.** D-01 = 500 m beyond the parcel edge. Delete "5 km radius" at `escrow-state-machine.md:35`. Greens: `Contract_GeofenceRadiusConsistent`.
16. **[Track B] D-01b GPS-spoof rule.** Flag `GPS_SPOOF` when implied speed between consecutive samples exceeds 40 km/h (tractor road max; threshold to be confirmed by Track B with field data), or when samples carry an identical fix for 10 minutes or more while ECU hours advance. Action: `FLAG_DISPUTE`, not freeze. Add `GPS_SPOOF` to the `003_telemetry.sql:13` allowed flags.
17. **[Track B] D-02 amendments.** (a) If `GPS_travel = 0` and ΔECU > 0.5 h, require the implement type. Stationary PTO implements use fuel-burn vs ECU instead of GPS. Others raise `FLAG_REVIEW`. (b) Any ECU sample lower than the previous sample (non-monotonic) is a `HOUR_TAMPER` regardless of the 10 % band.
18. **[Track B] D-06 vs 2G.** No-show requires all of the following: no GPS fix inside the parcel, no ECU hour increment on the next sync, and no renter check-in OTP within 24 h of dispatch. If the device has not synced since dispatch, the state is `NO_SHOW_PENDING` (no refund) until the first sync or 72 h, then manual review.
19. **[Track B] D-07 at listing.** Run the RC↔owner (Vahan) check at listing creation. `BLOCK_LISTING` happens there. P1 check 4 becomes a re-verification of the physical plate vs RC photo only, and a P1 mismatch → `RELEASE_COMPENSATION` (full renter refund + travel compensation charged to the lister's deposit).
20. **[Track B] D-08 mid-lease breakdown.** Trigger: ECU stops with a fault code, or renter report plus photo, after P1. Action: billing stops at the last verified ΔH, the renter pays verified ΔH only, the owner bears repair, and the platform offers the nearest replacement via `/v1/machines/near`. New state `SUSPENDED_BREAKDOWN`.
21. **[Track B] D-09 weather pause.** Trigger: an IMD rainfall alert for the parcel's district during the window, plus zero ΔECU for 2 h or more. Action: pause the billing clock and extend the window by the paused duration without penalty, capped at 48 h. After the cap, either party can cancel pro-rata.
22. **[Track B] Dispute SLA.** `DISPUTE_OPEN` must resolve within 72 h. Auto-rules resolve D-01/D-03/D-04 when evidence is complete. D-05 and contested cases go to platform ops. Evidence is frozen at entry (already stated) and made replayable from `telemetry_points`.

---

## 4. How to reproduce

Prerequisites: Redis on 127.0.0.1:6390 and PostgreSQL on 127.0.0.1:5440 (user `postgres`, no password). The tests skip if either is unreachable. Overrides: `REDIS_TEST_ADDR`, `PG_TEST_DSN`.

```sh
# All RED audit tests
cd showcase/go/booking-orchestrator && go test -count=1 -run TestAudit -v ./...
cd showcase/go/telemetry-gateway    && go test -count=1 -run TestAudit -v ./...

# By invariant
cd showcase/go/booking-orchestrator && go test -count=1 -run 'TestAudit_(Fencing|Heartbeat|Redlock)' -v ./internal/redlock/
cd showcase/go/booking-orchestrator && go test -count=1 -run 'TestAudit_(Saga|Contract)' -v ./internal/saga/
cd showcase/go/telemetry-gateway    && go test -count=1 -run 'TestAudit_D0' -v ./internal/geo/

# Adversarial concurrency simulations
cd showcase/go/booking-orchestrator && go test -count=1 -race -run TestAudit_Concurrency -v ./...
cd showcase/go/telemetry-gateway    && go test -count=1 -race -run TestAudit_Concurrency -v ./...
cd showcase/go/booking-orchestrator && go test -count=30 -run TestAudit_Concurrency_FiftyRacersOneHolder ./internal/redlock/   # stability

# Everything except the audit tests must stay green
cd showcase/go/booking-orchestrator && go test -count=1 -skip TestAudit ./... && go vet ./...
cd showcase/go/telemetry-gateway    && go test -count=1 -skip TestAudit ./... && go vet ./...
```

Test files: `showcase/go/booking-orchestrator/internal/redlock/audit_test.go`, `showcase/go/booking-orchestrator/internal/saga/audit_test.go`, `showcase/go/telemetry-gateway/internal/geo/audit_test.go`, `showcase/go/telemetry-gateway/internal/ws/audit_test.go`. `showcase/go/booking-orchestrator/go.mod` gains `github.com/jackc/pgx/v5 v5.5.5` (test-only use).
