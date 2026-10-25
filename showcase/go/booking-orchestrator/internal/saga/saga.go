// Package saga implements the KhetiRental booking orchestrator: a
// Kafka-driven saga that coordinates inventory reservation, escrow
// authorization, dispatch, telematics, and settlement, with compensating
// rollbacks on payment failure.
//
// Dual-write prohibition (per kafka-saga-orchestrator skill): a state
// mutation and its outgoing event MUST commit in the same DB transaction
// to the outbox_events table. A separate publisher (or Debezium CDC)
// drains the outbox to Kafka with at-least-once delivery. Consumers
// deduplicate by atomically inserting into processed_inbox_messages in
// the same transaction as their state update.
//
// Forward path:
//
//	ReserveInventory -> AuthorizeEscrowDeposit -> DispatchNotification
//
// Compensating path (if escrow auth fails or times out at 30 s SLA):
//
//	emit CompensateInventoryReservation, transition to FAILED_PAYMENT_RELEASED.
package saga

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/khetirental/booking-orchestrator/internal/redlock"
)

// EscrowAuthSLA is the maximum time the escrow provider may take to
// authorize the deposit before the saga compensates. A var so tests can shorten it.
var EscrowAuthSLA = 30 * time.Second

// BookingState is a booking's lifecycle state.
type BookingState string

const (
	StatePending           BookingState = "PENDING"
	StateInventoryReserved BookingState = "INVENTORY_RESERVED"
	StateEscrowAuthorized  BookingState = "ESCROW_AUTHORIZED"
	StateDispatched        BookingState = "DISPATCHED"
	StateTelematicsActive  BookingState = "TELEMATICS_ACTIVE"
	StatePostReturnAudit   BookingState = "POST_RETURN_AUDIT"
	StateSettled           BookingState = "SETTLED"
	StateFailedPayment     BookingState = "FAILED_PAYMENT_RELEASED"
	StateFailedInventory   BookingState = "FAILED_INVENTORY"
	StateDisputeOpen       BookingState = "DISPUTE_OPEN"        // D-01..D-05
	StateSuspendedBreak    BookingState = "SUSPENDED_BREAKDOWN" // D-08
	StateNoShowPending     BookingState = "NO_SHOW_PENDING"     // D-06 under 2G
)

// Event is the Kafka message envelope.
type Event struct {
	BookingID string       `json:"booking_id"`
	Type      EventType    `json:"type"`
	State     BookingState `json:"state"`
	Fencing   uint64       `json:"fencing_token"`
	Timestamp int64        `json:"ts"` // unix millis
}

// EventType is a Kafka event name.
type EventType string

const (
	evtReserveInventory     EventType = "booking.reserve_inventory"
	evtEscrowAuthorized     EventType = "escrow.authorized"
	evtDispatchNotification EventType = "dispatch.notification_sent"
	evtCompensateInventory  EventType = "booking.compensate_inventory"
	evtTelematicsActive     EventType = "telemetry.active_window"
	evtPostReturnAudit      EventType = "telemetry.post_return_audit"
	evtSettled              EventType = "escrow.settled"
	evtPaymentFailed        EventType = "escrow.payment_failed"
)

// OutboxEvent is a row in the outbox_events table.
type OutboxEvent struct {
	AggID  string
	Stream string
	Topic  string
	Data   []byte
}

// Store commits a booking transition and its outbox event in one
// transaction: both persist or neither does (no dual write). It returns 0
// rows when the fencing token is stale or the booking is already in that
// state or a terminal one, which makes every transition idempotent.
type Store interface {
	TransitionState(ctx context.Context, bookingID, newState string, fencing uint64, ev OutboxEvent) (int, error)
}

// EscrowAuthorizer authorizes (and, on failure, compensates) escrow.
type EscrowAuthorizer interface {
	Authorize(ctx context.Context, bookingID string) error
	Compensate(ctx context.Context, bookingID string) error
}

// InventoryManager reserves / releases inventory.
type InventoryManager interface {
	Reserve(ctx context.Context, bookingID string) error
	Release(ctx context.Context, bookingID string) error
}

// Notifier dispatches notifications.
type Notifier interface {
	Dispatch(ctx context.Context, bookingID string) error
}

// Fencer supplies the fencing token of the held lock (*redlock.Lock).
type Fencer interface {
	Fencing() uint64
}

// Orchestrator runs the saga for a single booking.
type Orchestrator struct {
	store     Store
	lock      Fencer
	inventory InventoryManager
	escrow    EscrowAuthorizer
	notify    Notifier
}

// NewOrchestrator wires an orchestrator for one booking under a held lock.
func NewOrchestrator(store Store, lock Fencer, inventory InventoryManager, escrow EscrowAuthorizer, notify Notifier) *Orchestrator {
	return &Orchestrator{store: store, lock: lock, inventory: inventory, escrow: escrow, notify: notify}
}

// Start runs the forward path up through dispatch. If escrow fails or its
// answer arrives after the SLA, the booking is compensated: it moves to
// FAILED_PAYMENT_RELEASED, the machine is released and the authorisation voided.
func (o *Orchestrator) Start(ctx context.Context, bookingID string) error {
	if err := o.inventory.Reserve(ctx, bookingID); err != nil {
		if serr := o.step(ctx, bookingID, StateFailedInventory, evtReserveInventory); serr != nil {
			return errors.Join(fmt.Errorf("saga: reserve inventory: %w", err), serr)
		}
		return fmt.Errorf("saga: reserve inventory: %w", err)
	}
	if err := o.step(ctx, bookingID, StateInventoryReserved, evtReserveInventory); err != nil {
		return err
	}

	// Authorize escrow under a bounded context (the 30 s SLA). An
	// answer after the deadline counts as a timeout even if it is a success.
	authCtx, cancel := context.WithTimeout(ctx, EscrowAuthSLA)
	defer cancel()
	err := o.escrow.Authorize(authCtx, bookingID)
	if authCtx.Err() != nil {
		return o.compensate(ctx, bookingID, "escrow auth timeout (>30s SLA)")
	}
	if err != nil {
		return o.compensate(ctx, bookingID, "escrow auth failed: "+err.Error())
	}
	if err := o.step(ctx, bookingID, StateEscrowAuthorized, evtEscrowAuthorized); err != nil {
		return err
	}

	if err := o.notify.Dispatch(ctx, bookingID); err != nil {
		return fmt.Errorf("saga: dispatch notification: %w", err)
	}
	return o.step(ctx, bookingID, StateDispatched, evtDispatchNotification)
}

// Compensate runs the compensating path (also the handler for a redelivered
// compensation event): it is a no-op once the booking has been compensated.
func (o *Orchestrator) Compensate(ctx context.Context, bookingID string, reason string) error {
	return o.compensate(ctx, bookingID, reason)
}

func (o *Orchestrator) compensate(ctx context.Context, bookingID, reason string) error {
	// Guarded transition first: only the first delivery gets a row, so the
	// side effects below run once however often the event is redelivered.
	err := o.step(ctx, bookingID, StateFailedPayment, evtCompensateInventory)
	if errors.Is(err, redlock.ErrStaleFencing) {
		return nil // already compensated (or a newer holder owns the booking)
	}
	if err != nil {
		return fmt.Errorf("saga: compensate (%s): %w", reason, err)
	}
	return errors.Join(
		wrap("compensate release inventory", o.inventory.Release(ctx, bookingID)),
		wrap("compensate void escrow", o.escrow.Compensate(ctx, bookingID)),
	)
}

// step commits one state transition together with its outbox event. 0 rows
// means the lock was lost or the step already happened: stop, no side effects.
func (o *Orchestrator) step(ctx context.Context, bookingID string, state BookingState, t EventType) error {
	data, err := json.Marshal(Event{
		BookingID: bookingID,
		Type:      t,
		State:     state,
		Fencing:   o.lock.Fencing(),
		Timestamp: time.Now().UnixMilli(),
	})
	if err != nil {
		return fmt.Errorf("saga: encode %s event: %w", t, err)
	}
	rows, err := o.store.TransitionState(ctx, bookingID, string(state), o.lock.Fencing(),
		OutboxEvent{AggID: bookingID, Stream: "booking", Topic: "booking.events", Data: data})
	if err != nil {
		return fmt.Errorf("saga: transition to %s: %w", state, err)
	}
	if err := (&redlock.SQLFencedBookingStore{}).ApplyTransition(rows); err != nil {
		return fmt.Errorf("saga: transition to %s: %w", state, err)
	}
	return nil
}

func wrap(what string, err error) error {
	if err != nil {
		return fmt.Errorf("saga: %s: %w", what, err)
	}
	return nil
}
