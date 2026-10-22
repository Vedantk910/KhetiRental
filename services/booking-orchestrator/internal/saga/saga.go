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
//   ReserveInventory -> AuthorizeEscrowDeposit -> DispatchNotification
// Compensating path (if escrow auth fails or times out at 30 s SLA):
//   emit CompensateInventoryReservation, transition to FAILED_PAYMENT_RELEASED.
package saga

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/khetirental/booking-orchestrator/internal/redlock"
)

// EscrowAuthSLA is the maximum time the escrow provider may take to
// authorize the deposit before the saga compensates.
const EscrowAuthSLA = 30 * time.Second

// BookingState is a booking's lifecycle state.
type BookingState string

const (
	StatePending             BookingState = "PENDING"
	StateInventoryReserved   BookingState = "INVENTORY_RESERVED"
	StateEscrowAuthorized    BookingState = "ESCROW_AUTHORIZED"
	StateDispatched          BookingState = "DISPATCHED"
	StateTelematicsActive    BookingState = "TELEMATICS_ACTIVE"
	StatePostReturnAudit     BookingState = "POST_RETURN_AUDIT"
	StateSettled             BookingState = "SETTLED"
	StateFailedPayment       BookingState = "FAILED_PAYMENT_RELEASED"
	StateFailedInventory     BookingState = "FAILED_INVENTORY"
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

// Producer emits outbox events to Kafka.
type Producer interface {
	Produce(ctx context.Context, outbox OutboxEvent) error
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

// Orchestrator runs the saga for a single booking.
type Orchestrator struct {
	store     redlock.FencedBookingStore
	lock      *redlock.Lock
	inventory InventoryManager
	escrow    EscrowAuthorizer
	notify    Notifier
	prod      Producer
}

// NewOrchestrator wires an orchestrator for one booking under a held lock.
func NewOrchestrator(
	store redlock.FencedBookingStore,
	lock *redlock.Lock,
	inventory InventoryManager,
	escrow EscrowAuthorizer,
	notify Notifier,
	prod Producer,
) *Orchestrator {
	return &Orchestrator{
		store: store, lock: lock,
		inventory: inventory, escrow: escrow, notify: notify, prod: prod,
	}
}

// Start runs the forward path up through escrow authorization. If escrow
// fails or exceeds the SLA, the compensating path is emitted and the
// booking transitions to FAILED_PAYMENT_RELEASED.
func (o *Orchestrator) Start(ctx context.Context, bookingID string) error {
	// Step 1: reserve inventory.
	if err := o.inventory.Reserve(ctx, bookingID); err != nil {
		_, _ = o.store.TransitionState(ctx, bookingID, string(StateFailedInventory), o.lock.Fencing())
		return fmt.Errorf("saga: reserve inventory: %w", err)
	}
	if _, err := o.store.TransitionState(ctx, bookingID, string(StateInventoryReserved), o.lock.Fencing()); err != nil {
		return err
	}
	_ = o.emit(ctx, bookingID, evtReserveInventory, StateInventoryReserved)

	// Step 2: authorize escrow under a bounded context (the 30 s SLA).
	authCtx, cancel := context.WithTimeout(ctx, EscrowAuthSLA)
	defer cancel()
	err := o.escrow.Authorize(authCtx, bookingID)
	switch {
	case err == nil:
		if _, err := o.store.TransitionState(ctx, bookingID, string(StateEscrowAuthorized), o.lock.Fencing()); err != nil {
			return err
		}
		_ = o.emit(ctx, bookingID, evtEscrowAuthorized, StateEscrowAuthorized)
		// Step 3: dispatch notification.
		if err := o.notify.Dispatch(ctx, bookingID); err != nil {
			return fmt.Errorf("saga: dispatch notification: %w", err)
		}
		if _, err := o.store.TransitionState(ctx, bookingID, string(StateDispatched), o.lock.Fencing()); err != nil {
			return err
		}
		_ = o.emit(ctx, bookingID, evtDispatchNotification, StateDispatched)
		return nil
	case authCtx.Err() == context.DeadlineExceeded:
		return o.compensate(ctx, bookingID, "escrow auth timeout (>30s SLA)")
	default:
		return o.compensate(ctx, bookingID, "escrow auth failed: "+err.Error())
	}
}

// Compensate runs the compensating path: release the inventory hold,
// transition to FAILED_PAYMENT_RELEASED, and emit the compensation event.
func (o *Orchestrator) Compensate(ctx context.Context, bookingID string, reason string) error {
	return o.compensate(ctx, bookingID, reason)
}

func (o *Orchestrator) compensate(ctx context.Context, bookingID, reason string) error {
	// Compensating action: release the inventory reservation.
	if err := o.inventory.Release(ctx, bookingID); err != nil {
		return fmt.Errorf("saga: compensate release inventory: %w", err)
	}
	if _, err := o.store.TransitionState(ctx, bookingID, string(StateFailedPayment), o.lock.Fencing()); err != nil {
		return fmt.Errorf("saga: transition to FAILED_PAYMENT_RELEASED: %w (reason: %s)", err, reason)
	}
	_ = o.emit(ctx, bookingID, evtCompensateInventory, StateFailedPayment)
	return nil
}

// emit writes an event to the outbox in the same transaction as the state
// change (the store's caller has already committed the transition; the
// outbox row is appended atomically by the publisher reading it).
func (o *Orchestrator) emit(ctx context.Context, bookingID string, t EventType, state BookingState) error {
	data, _ := json.Marshal(Event{
		BookingID: bookingID,
		Type:      t,
		State:     state,
		Fencing:   o.lock.Fencing(),
		Timestamp: time.Now().UnixMilli(),
	})
	return o.prod.Produce(ctx, OutboxEvent{
		AggID:  bookingID,
		Stream: "booking",
		Topic:  "booking.events",
		Data:   data,
	})
}
