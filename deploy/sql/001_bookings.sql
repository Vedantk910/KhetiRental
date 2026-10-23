-- Bookings: ACID system of record for the saga (booking-orchestrator).
-- fencing_token carries the Redlock token of the last writer; writes from a
-- holder whose lease lapsed must be rejected (see internal/redlock).
CREATE TABLE IF NOT EXISTS bookings (
    booking_id      TEXT PRIMARY KEY,
    machine_id      TEXT NOT NULL,
    renter_id       TEXT NOT NULL,
    -- Idempotency-Key header of the creating request: a retried 2G POST
    -- must not create a second booking.
    idempotency_key TEXT NOT NULL UNIQUE,
    state           TEXT NOT NULL CHECK (state IN (
                        'PENDING', 'INVENTORY_RESERVED', 'ESCROW_AUTHORIZED',
                        'DISPATCHED', 'TELEMATICS_ACTIVE', 'POST_RETURN_AUDIT',
                        'SETTLED', 'FAILED_PAYMENT_RELEASED', 'FAILED_INVENTORY')),
    fencing_token   BIGINT NOT NULL CHECK (fencing_token >= 0),
    payload         JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bookings_machine ON bookings (machine_id);
