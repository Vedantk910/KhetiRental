package saga

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"testing"
	"time"
)

type fakeFencer uint64

func (f fakeFencer) Fencing() uint64 { return uint64(f) }

type fakeStore struct{ states []string }

func (s *fakeStore) CreateBooking(context.Context, string, uint64, []byte) error { return nil }
func (s *fakeStore) TransitionState(_ context.Context, _ string, st string, _ uint64) (int, error) {
	s.states = append(s.states, st)
	return 1, nil
}

type fakeDeps struct {
	reserveErr, authErr error
	authDelay           time.Duration
	released            bool
	escrowCompensated   bool
	dispatched          bool
	events              []EventType
}

func (d *fakeDeps) Reserve(context.Context, string) error { return d.reserveErr }
func (d *fakeDeps) Release(context.Context, string) error { d.released = true; return nil }
func (d *fakeDeps) Authorize(ctx context.Context, _ string) error {
	select {
	case <-time.After(d.authDelay):
		return d.authErr
	case <-ctx.Done():
		return ctx.Err()
	}
}
func (d *fakeDeps) Compensate(context.Context, string) error { d.escrowCompensated = true; return nil }
func (d *fakeDeps) Dispatch(context.Context, string) error   { d.dispatched = true; return nil }
func (d *fakeDeps) Produce(_ context.Context, ev OutboxEvent) error {
	var e Event
	if err := json.Unmarshal(ev.Data, &e); err != nil {
		return err
	}
	d.events = append(d.events, e.Type)
	return nil
}

func run(t *testing.T, d *fakeDeps) (*fakeStore, error) {
	t.Helper()
	st := &fakeStore{}
	err := NewOrchestrator(st, fakeFencer(42), d, d, d, d).Start(context.Background(), "B-1")
	return st, err
}

func TestHappyPath(t *testing.T) {
	d := &fakeDeps{}
	st, err := run(t, d)
	if err != nil {
		t.Fatal(err)
	}
	if want := []string{"INVENTORY_RESERVED", "ESCROW_AUTHORIZED", "DISPATCHED"}; !reflect.DeepEqual(st.states, want) {
		t.Fatalf("states %v want %v", st.states, want)
	}
	if want := []EventType{evtReserveInventory, evtEscrowAuthorized, evtDispatchNotification}; !reflect.DeepEqual(d.events, want) {
		t.Fatalf("events %v want %v", d.events, want)
	}
	if d.released || !d.dispatched {
		t.Fatalf("released=%v dispatched=%v", d.released, d.dispatched)
	}
}

func TestReserveFailureStopsSaga(t *testing.T) {
	d := &fakeDeps{reserveErr: errors.New("machine taken")}
	st, err := run(t, d)
	if err == nil {
		t.Fatal("expected error")
	}
	if want := []string{"FAILED_INVENTORY"}; !reflect.DeepEqual(st.states, want) {
		t.Fatalf("states %v want %v", st.states, want)
	}
	if len(d.events) != 0 || d.dispatched {
		t.Fatalf("saga continued after reserve failure: events=%v", d.events)
	}
}

func TestEscrowFailureCompensates(t *testing.T) {
	d := &fakeDeps{authErr: errors.New("card declined")}
	st, _ := run(t, d)
	if want := []string{"INVENTORY_RESERVED", "FAILED_PAYMENT_RELEASED"}; !reflect.DeepEqual(st.states, want) {
		t.Fatalf("states %v want %v", st.states, want)
	}
	if !d.released || d.dispatched {
		t.Fatalf("released=%v dispatched=%v", d.released, d.dispatched)
	}
	if last := d.events[len(d.events)-1]; last != evtCompensateInventory {
		t.Fatalf("last event %v want %v", last, evtCompensateInventory)
	}
}

func TestEscrowTimeoutCompensates(t *testing.T) {
	defer func(old time.Duration) { EscrowAuthSLA = old }(EscrowAuthSLA)
	EscrowAuthSLA = 20 * time.Millisecond

	d := &fakeDeps{authDelay: time.Second}
	start := time.Now()
	st, _ := run(t, d)
	if time.Since(start) > 500*time.Millisecond {
		t.Fatal("saga did not honour the escrow SLA")
	}
	if want := []string{"INVENTORY_RESERVED", "FAILED_PAYMENT_RELEASED"}; !reflect.DeepEqual(st.states, want) {
		t.Fatalf("states %v want %v", st.states, want)
	}
	if !d.released {
		t.Fatal("inventory not released after SLA timeout")
	}
}
