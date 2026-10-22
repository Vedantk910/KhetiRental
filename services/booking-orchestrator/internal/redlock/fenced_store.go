// Package redlock — fenced_store.go
//
// The fencing token is only meaningful if the storage layer validates it.
// This file defines the database-side contract: every booking row carries a
// fencing_token column, and any state-mutation must carry a fencing token
// strictly greater than the stored one. A stale lock holder (whose lease
// lapsed and was re-acquired by another node) will present an older token
// and be rejected with ErrStaleFencing.
package redlock

import (
	"context"
	"errors"
	"fmt"
)

// ErrStaleFencing is returned when a write's fencing token is not newer than
// the row's current token — i.e. the caller's lock has lapsed and been
// re-acquired by another process.
var ErrStaleFencing = errors.New("fenced store: stale fencing token")

// FencedBookingStore is the interface the saga uses to persist booking
// state while honouring fencing-token validation.
type FencedBookingStore interface {
	// CreateBooking inserts a new row with the given initial fencing token.
	CreateBooking(ctx context.Context, bookingID string, initialFencing uint64, payload []byte) error

	// TransitionState atomically moves the booking to the next state,
	// guarded by a fencing-token comparison (WHERE fencing_token = old).
	// Returns rows-affected (0 if the token was stale).
	TransitionState(ctx context.Context, bookingID string, newState string, expectedFencing uint64) (int, error)
}

// SQLFencedBookingStore is a reference DDL + logic sketch for the
// PostgreSQL implementation. It is not a live driver; it documents the
// exact SQL the production store runs, so Lead 1 can wire it to a real
// pgx pool in deploy/.
type SQLFencedBookingStore struct {
	// DDL for the bookings table (run once at migration).
	SchemaDDL string
}

// NewSQLFencedBookingStore returns the store with its migration DDL.
func NewSQLFencedBookingStore() *SQLFencedBookingStore {
	return &SQLFencedBookingStore{
		SchemaDDL: `
CREATE TABLE IF NOT EXISTS bookings (
    booking_id      TEXT PRIMARY KEY,
    state           TEXT NOT NULL,
    fencing_token   BIGINT NOT NULL,
    payload         JSONB NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- The fencing token is only ever increased, so this index also backs
-- the optimistic-concurrency WHERE clause in TransitionState.
CREATE INDEX IF NOT EXISTS idx_bookings_fencing ON bookings (fencing_token);
`,
	}
}

// TransitionSQL returns the optimistic-concurrency UPDATE that the store
// executes on every state transition. expectedFencing is the caller's
// current lock token; if another process advanced the row past it, the
// UPDATE affects 0 rows and the caller must abort (compensate).
func (s *SQLFencedBookingStore) TransitionSQL(bookingID, newState string, expectedFencing uint64) (string, []interface{}) {
	const q = `
UPDATE bookings
   SET state = $1,
       fencing_token = fencing_token + 1,
       updated_at = now()
 WHERE booking_id = $2
   AND fencing_token = $3;`
	return q, []interface{}{newState, bookingID, expectedFencing}
}

// ApplyTransition documents the check a caller performs on rows-affected.
// If 0 rows changed, the fencing token was stale and the caller's lock
// lapsed — the saga must run its compensating path.
func (s *SQLFencedBookingStore) ApplyTransition(rowsAffected int) error {
	if rowsAffected == 0 {
		return fmt.Errorf("%w: 0 rows updated (lock lost)", ErrStaleFencing)
	}
	return nil
}
