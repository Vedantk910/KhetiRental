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
	"errors"
	"fmt"
)

// ErrStaleFencing is returned when a write's fencing token is not newer than
// the row's current token — i.e. the caller's lock has lapsed and been
// re-acquired by another process.
var ErrStaleFencing = errors.New("fenced store: stale fencing token")

// SQLFencedBookingStore holds the exact SQL the PostgreSQL store
// (internal/pgstore) runs against the bookings table.
type SQLFencedBookingStore struct{}

// NewSQLFencedBookingStore returns the reference SQL store.
func NewSQLFencedBookingStore() *SQLFencedBookingStore { return &SQLFencedBookingStore{} }

// TransitionSQL returns the fenced UPDATE the store executes on every state
// transition. The holder may write while its token is at least the row's
// (so it can transition repeatedly) and stamps the row with its token; a
// paused holder with an older token than the row's gets 0 rows and must
// abort. Moving to the current state, or out of a terminal one, is also 0
// rows, so redelivered steps are no-ops. showcase/deploy/sql/004 additionally
// forbids the token ever decreasing.
func (s *SQLFencedBookingStore) TransitionSQL(bookingID, newState string, fencing uint64) (string, []interface{}) {
	const q = `
UPDATE bookings
   SET state = $1,
       fencing_token = $3,
       updated_at = now()
 WHERE booking_id = $2
   AND fencing_token <= $3
   AND state <> $1
   AND state NOT IN ('SETTLED', 'FAILED_PAYMENT_RELEASED', 'FAILED_INVENTORY');`
	return q, []interface{}{newState, bookingID, fencing}
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
