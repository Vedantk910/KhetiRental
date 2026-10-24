// Package pgstore is the PostgreSQL implementation of saga.Store: each
// booking transition and its outbox event commit in one transaction
// (schema: showcase/deploy/sql/001_bookings.sql, 002_outbox_inbox.sql, 004_fencing.sql).
package pgstore

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/khetirental/booking-orchestrator/internal/redlock"
	"github.com/khetirental/booking-orchestrator/internal/saga"
)

// Store persists bookings and their outbox events.
type Store struct{ db *pgxpool.Pool }

// New returns a Store over the pool.
func New(db *pgxpool.Pool) *Store { return &Store{db: db} }

// CreateBooking inserts a PENDING booking stamped with the creator's token.
func (s *Store) CreateBooking(ctx context.Context, bookingID, machineID, renterID, idempotencyKey string, fencing uint64) error {
	_, err := s.db.Exec(ctx, `
INSERT INTO bookings (booking_id, machine_id, renter_id, idempotency_key, state, fencing_token)
VALUES ($1, $2, $3, $4, 'PENDING', $5)`, bookingID, machineID, renterID, idempotencyKey, int64(fencing))
	return err
}

// TransitionState applies the fenced transition and, only if it took
// effect, appends its outbox event, all in one transaction.
func (s *Store) TransitionState(ctx context.Context, bookingID, newState string, fencing uint64, ev saga.OutboxEvent) (int, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op after Commit
	q, args := redlock.NewSQLFencedBookingStore().TransitionSQL(bookingID, newState, fencing)
	args[2] = int64(fencing) // pgx has no uint64 → BIGINT codec
	tag, err := tx.Exec(ctx, q, args...)
	if err != nil {
		return 0, err
	}
	if tag.RowsAffected() == 0 {
		return 0, nil
	}
	if _, err := tx.Exec(ctx, `
INSERT INTO outbox_events (aggregate_type, aggregate_id, stream, topic, data)
VALUES ('booking', $1, $2, $3, $4)`, ev.AggID, ev.Stream, ev.Topic, ev.Data); err != nil {
		return 0, fmt.Errorf("pgstore: outbox insert: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return 1, nil
}
