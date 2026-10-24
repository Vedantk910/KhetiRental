-- Dispute (D-01..D-05), mid-lease breakdown (D-08) and 2G no-show (D-06)
-- states. 001 already lists them for fresh databases; this replaces the
-- CHECK on databases created before they existed.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_state_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_state_check CHECK (state IN (
    'PENDING', 'INVENTORY_RESERVED', 'ESCROW_AUTHORIZED',
    'DISPATCHED', 'TELEMATICS_ACTIVE', 'POST_RETURN_AUDIT',
    'SETTLED', 'FAILED_PAYMENT_RELEASED', 'FAILED_INVENTORY',
    'DISPUTE_OPEN', 'SUSPENDED_BREAKDOWN', 'NO_SHOW_PENDING'));
