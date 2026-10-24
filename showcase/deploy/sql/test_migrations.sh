#!/usr/bin/env bash
# Integration test for showcase/deploy/sql migrations against a real Postgres.
# Creates a throwaway database, applies every migration twice (must be
# idempotent), then checks the constraints the contracts depend on.
#   PGHOST/PGPORT/PGUSER select the server (default 127.0.0.1:5440 postgres).
# Exits 0 and prints SKIP when psql or the server is unavailable.
set -euo pipefail
cd "$(dirname "$0")"
export PGHOST="${PGHOST:-127.0.0.1}" PGPORT="${PGPORT:-5440}" PGUSER="${PGUSER:-postgres}"
command -v psql >/dev/null || { echo "SKIP: psql not installed"; exit 0; }
psql -d postgres -qtAc 'select 1' >/dev/null 2>&1 || { echo "SKIP: postgres $PGHOST:$PGPORT unreachable"; exit 0; }

DB="khetirental_migtest_$$"
psql -d postgres -qc "CREATE DATABASE $DB"
trap 'psql -d postgres -qc "DROP DATABASE IF EXISTS $DB" >/dev/null' EXIT
q() { psql -d "$DB" -v ON_ERROR_STOP=1 -qtAc "$1"; }
fail=0
expect_ok()  { if q "$2" >/dev/null 2>&1; then echo "  ok   $1"; else echo "  FAIL $1"; fail=1; fi; }
expect_err() { if q "$2" >/dev/null 2>&1; then echo "  FAIL $1 (accepted)"; fail=1; else echo "  ok   $1"; fi; }

for pass in 1 2; do
  for f in [0-9][0-9][0-9]_*.sql; do
    psql -d "$DB" -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null 2>&1 || { echo "  FAIL apply $f (pass $pass)"; exit 1; }
  done
done
echo "  ok   all migrations apply twice (idempotent)"

B="INSERT INTO bookings (booking_id, machine_id, renter_id, idempotency_key, state, fencing_token)"
expect_ok  "insert valid booking"                 "$B VALUES ('B-1','M-1','R-1','idem-1','PENDING',1)"
expect_err "reject unknown booking state"         "$B VALUES ('B-2','M-1','R-1','idem-2','BOGUS',1)"
expect_err "reject replayed Idempotency-Key"      "$B VALUES ('B-3','M-1','R-1','idem-1','PENDING',1)"
expect_err "reject negative fencing token"        "$B VALUES ('B-4','M-1','R-1','idem-4','PENDING',-1)"
for st in DISPUTE_OPEN SUSPENDED_BREAKDOWN NO_SHOW_PENDING; do
  expect_ok "accept state $st"                    "$B VALUES ('B-$st','M-1','R-1','idem-$st','$st',1)"
done
# A database created before 005 still has the old CHECK; 005 must widen it.
q "DELETE FROM bookings WHERE state IN ('DISPUTE_OPEN','SUSPENDED_BREAKDOWN','NO_SHOW_PENDING'); ALTER TABLE bookings DROP CONSTRAINT bookings_state_check; ALTER TABLE bookings ADD CONSTRAINT bookings_state_check CHECK (state IN ('PENDING','SETTLED'))" >/dev/null
psql -d "$DB" -v ON_ERROR_STOP=1 -q -f 005_booking_states.sql >/dev/null 2>&1 || { echo "  FAIL apply 005 over the pre-005 CHECK"; fail=1; }
expect_ok  "005 upgrades pre-005 CHECK"           "$B VALUES ('B-up','M-1','R-1','idem-up','DISPUTE_OPEN',1)"

expect_ok  "fencing token may advance"            "UPDATE bookings SET fencing_token = 5 WHERE booking_id = 'B-1'"
expect_ok  "fencing token may stay"               "UPDATE bookings SET fencing_token = 5, state = 'INVENTORY_RESERVED' WHERE booking_id = 'B-1'"
expect_err "reject decreasing fencing token"      "UPDATE bookings SET fencing_token = 4 WHERE booking_id = 'B-1'"

expect_ok  "outbox row defaults to unpublished"   "INSERT INTO outbox_events (aggregate_type, aggregate_id, stream, topic, data) VALUES ('booking','B-1','booking','booking.events','{}'); SELECT 1 FROM outbox_events WHERE published_at IS NULL"
expect_ok  "inbox accepts first delivery"         "INSERT INTO processed_inbox_messages (topic, message_id) VALUES ('booking.events','m-1')"
expect_err "inbox rejects duplicate delivery"     "INSERT INTO processed_inbox_messages (topic, message_id) VALUES ('booking.events','m-1')"

T="INSERT INTO telemetry_points (machine_id, observed_at, lat, lng, ecu_hours, fuel_level_pct)"
expect_ok  "insert telemetry sample"              "$T VALUES ('M-1', now(), 26.84, 75.81, 124.6, 78)"
expect_err "reject replayed telemetry sample"     "$T SELECT machine_id, observed_at, lat, lng, ecu_hours, fuel_level_pct FROM telemetry_points LIMIT 1"
expect_err "reject fuel level > 100"              "$T VALUES ('M-1', now() + interval '1s', 26.84, 75.81, 124.6, 101)"
expect_err "reject unknown anomaly flag"          "INSERT INTO telemetry_points (machine_id, observed_at, lat, lng, ecu_hours, anomaly_flags) VALUES ('M-1', now() + interval '2s', 26.84, 75.81, 1, '{NOPE}')"

if q "SELECT 1 FROM pg_extension WHERE extname='timescaledb'" | grep -q 1; then
  expect_ok "telemetry_points is a hypertable"    "SELECT 1/count(*) FROM timescaledb_information.hypertables WHERE hypertable_name='telemetry_points'"
else
  echo "  note timescaledb extension not installed; hypertable step skipped by 003"
fi

[ "$fail" = 0 ] && echo "PASS showcase/deploy/sql migrations" || { echo "FAIL showcase/deploy/sql migrations"; exit 1; }
