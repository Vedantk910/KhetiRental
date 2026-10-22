# Shared data schemas (contract between Lead 1 and Lead 2)

These are the JSON/Go data models both leads consume. **Lead 2 owns the
shape** (field semantics, validation rules); **Lead 1 owns the
implementation** (Go types, Postgres columns, TimescaleDB hypertables).

## Machine
```json
{
  "machine_id": "M-0042",
  "owner_id": "O-11",
  "hp_tier": "45",
  "age_years": 6,
  "acquisition_cost_inr": 650000,
  "location": { "lat": 26.8467, "lng": 75.8160, "h3_res8": "89c223f6f6171bf" },
  "status": "LISTED",
  "reputation": 0.87
}
```

## Booking
```json
{
  "booking_id": "B-2026-000123",
  "machine_id": "M-0042",
  "renter_id": "R-4821",
  "state": "ESCROW_AUTHORIZED",
  "fencing_token": 142,
  "base_rental_inr": 4200,
  "deposit_inr": 630,
  "escrow_ref": "ESC-9912",
  "parcel": { "h3_res8": "89c223f6f6171bf", "radius_m": 5000 }
}
```

## Telemetry sample (one CRDT element value)
```json
{
  "machine_id": "M-0042",
  "observed_at": 1718000000000,
  "lat": 26.8471, "lng": 75.8158,
  "ecu_hours": 124.6,
  "gps_travel_hours": 124.2,
  "fuel_level_pct": 78,
  "anomaly_flags": []
}
```

## Event envelopes
- `contracts/events/booking.events.json` — booking topic schema
- `contracts/events/telemetry.events.json` — telemetry topic schema

Every mutating API call in `contracts/openapi.yaml` requires an
`Idempotency-Key` header; the booking outbox keys off that value so a
retried 2G request does not double-reserve inventory.
