package saga

// Phase 1 invariant audit (docs/audit/phase1-invariant-audit.md).
// TestAudit_* tests are RED by design: each fails against today's code and
// passes once the corresponding remediation lands.

import (
	"context"
	"errors"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/khetirental/booking-orchestrator/internal/redlock"
)

// auditStore models the DB-side guard: a stale token or a transition out of
// a terminal state affects 0 rows.
//
// Adapted for remediation 3: the store now receives the outbox event and
// writes it in the same transaction as the state (out models that insert;
// an insert error rolls the state back). Assertions are unchanged.
type auditStore struct {
	state     string
	staleAll  bool
	committed []string
	out       Producer
}

func (s *auditStore) TransitionState(ctx context.Context, _ string, st string, _ uint64, ev OutboxEvent) (int, error) {
	if s.staleAll || s.state == string(StateFailedPayment) || s.state == string(StateSettled) {
		return 0, nil
	}
	if err := s.out.Produce(ctx, ev); err != nil {
		return 0, err
	}
	s.state = st
	s.committed = append(s.committed, st)
	return 1, nil
}

// Producer is the outbox insert the fake stores call inside their "transaction".
type Producer interface {
	Produce(context.Context, OutboxEvent) error
}

type countingDeps struct {
	fakeDeps
	releases   int
	produceErr error
}

func (d *countingDeps) Release(ctx context.Context, id string) error {
	d.releases++
	return d.fakeDeps.Release(ctx, id)
}
func (d *countingDeps) Produce(ctx context.Context, ev OutboxEvent) error {
	if d.produceErr != nil {
		return d.produceErr
	}
	return d.fakeDeps.Produce(ctx, ev)
}

// lateApprover ignores the SLA context and approves after a delay, like a
// provider whose HTTP call returns 200 after the saga's deadline.
type lateApprover struct {
	countingDeps
	delay time.Duration
}

func (d *lateApprover) Authorize(context.Context, string) error {
	time.Sleep(d.delay)
	return nil
}

// FR-4 / PRD §6 "Payment timeout": on SLA breach the escrow authorisation
// must be voided, not only the inventory released.
func TestAudit_Saga_TimeoutVoidsEscrowAuthorization(t *testing.T) {
	defer func(old time.Duration) { EscrowAuthSLA = old }(EscrowAuthSLA)
	EscrowAuthSLA = 20 * time.Millisecond
	d := &fakeDeps{authDelay: time.Second}
	st, _ := run(t, d)
	if !d.escrowCompensated {
		t.Fatalf("SLA exceeded, states=%v, but EscrowAuthorizer.Compensate was never called: a late provider approval leaves a ghost hold", st.states)
	}
}

// A provider that returns success after the SLA must not move the booking forward.
func TestAudit_Saga_LateApprovalAfterSLACompensates(t *testing.T) {
	defer func(old time.Duration) { EscrowAuthSLA = old }(EscrowAuthSLA)
	EscrowAuthSLA = 20 * time.Millisecond
	d := &lateApprover{delay: 60 * time.Millisecond}
	st := &auditStore{out: d}
	_ = NewOrchestrator(st, fakeFencer(42), d, d, d).Start(context.Background(), "B-late")
	if st.state != string(StateFailedPayment) || d.dispatched || !d.escrowCompensated {
		t.Fatalf("approval arrived after %s SLA: final state=%s dispatched=%v escrowVoided=%v (want FAILED_PAYMENT_RELEASED, false, true)",
			EscrowAuthSLA, st.state, d.dispatched, d.escrowCompensated)
	}
}

// saga.go:142,153,161,184 discard rows-affected. 0 rows means the lock was
// lost (fenced_store.go:59); the saga must abort with ErrStaleFencing.
func TestAudit_Saga_StaleFencingZeroRowsAborts(t *testing.T) {
	d := &countingDeps{}
	st := &auditStore{staleAll: true, out: d}
	err := NewOrchestrator(st, fakeFencer(42), d, d, d).Start(context.Background(), "B-stale")
	if !errors.Is(err, redlock.ErrStaleFencing) || d.dispatched || len(d.events) != 0 {
		t.Fatalf("every write was fenced out (0 rows) yet err=%v dispatched=%v events=%v", err, d.dispatched, d.events)
	}
}

// Redelivered compensation (at-least-once Kafka) must be a no-op the second time.
func TestAudit_Saga_CompensationIdempotent(t *testing.T) {
	d := &countingDeps{}
	st := &auditStore{state: string(StateInventoryReserved), out: d}
	o := NewOrchestrator(st, fakeFencer(42), d, d, d)
	_ = o.Compensate(context.Background(), "B-c", "escrow timeout")
	_ = o.Compensate(context.Background(), "B-c", "escrow timeout (redelivered)")
	n := 0
	for _, e := range d.events {
		if e == evtCompensateInventory {
			n++
		}
	}
	if d.releases != 1 || n != 1 {
		t.Fatalf("compensation replayed: inventory.Release called %d times, %d compensation events emitted (want 1, 1)", d.releases, n)
	}
}

// FR-5 dual-write prohibition: a state change must not commit without its
// event. emit errors are discarded today (saga.go:145,156,164,187).
func TestAudit_Saga_OutboxWriteFailureAbortsTransition(t *testing.T) {
	d := &countingDeps{produceErr: errors.New("outbox insert failed")}
	st := &auditStore{out: d}
	err := NewOrchestrator(st, fakeFencer(42), d, d, d).Start(context.Background(), "B-dw")
	if err == nil || d.dispatched || len(st.committed) != len(d.events) {
		t.Fatalf("outbox write failed on every event yet err=%v dispatched=%v committed states=%v events=%v",
			err, d.dispatched, st.committed, d.events)
	}
}

func readRepo(t *testing.T, rel string) string {
	t.Helper()
	b, err := os.ReadFile("../../../../" + rel)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

// openapi.yaml:100 returns 409 for "dispute open", escrow-state-machine.md:98
// defines DISPUTE_OPEN, but no persisted state can represent it.
func TestAudit_Contract_DisputeOpenStateRepresentable(t *testing.T) {
	missing := []string{}
	for _, f := range []string{"contracts/openapi.yaml", "deploy/sql/001_bookings.sql"} {
		if !strings.Contains(readRepo(t, f), "DISPUTE_OPEN") {
			missing = append(missing, f)
		}
	}
	if len(missing) > 0 {
		t.Fatalf("DISPUTE_OPEN absent from %v: a frozen deposit / open dispute cannot be persisted or returned", missing)
	}
}

// escrow-state-machine.md:51,137 say 15 % security deposit; :93 says 115 %.
func TestAudit_Contract_DepositDefinitionConsistent(t *testing.T) {
	doc := readRepo(t, "contracts/escrow-state-machine.md")
	if strings.Contains(doc, "deposit = 115 % of base rental") && strings.Contains(doc, "Security deposit (15 %)") {
		t.Fatal("deposit defined both as 115 % of base rental (HOLD invariant) and as a 15 % security deposit")
	}
}

// escrow-state-machine.md:35 says 5 km geofence; D-01 (:122) and anomaly.go say 500 m.
func TestAudit_Contract_GeofenceRadiusConsistent(t *testing.T) {
	doc := readRepo(t, "contracts/escrow-state-machine.md")
	if strings.Contains(doc, "5 km radius") && strings.Contains(doc, "> 500 m outside registered parcel") {
		t.Fatal("geofence is 5 km in the milestone table but 500 m in D-01")
	}
}

// syncStore / syncDeps are goroutine-safe versions of auditStore / countingDeps.
type syncStore struct {
	mu sync.Mutex
	auditStore
}

func (s *syncStore) TransitionState(ctx context.Context, id, st string, f uint64, ev OutboxEvent) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.auditStore.TransitionState(ctx, id, st, f, ev)
}

type syncDeps struct {
	mu       sync.Mutex
	releases int
	events   int
	fakeDeps
}

func (d *syncDeps) Release(context.Context, string) error {
	d.mu.Lock()
	d.releases++
	d.mu.Unlock()
	return nil
}
func (d *syncDeps) Produce(context.Context, OutboxEvent) error {
	d.mu.Lock()
	d.events++
	d.mu.Unlock()
	return nil
}

// The same compensation event redelivered N times concurrently: Release must
// take effect once and the booking must end FAILED_PAYMENT_RELEASED.
func TestAudit_Concurrency_CompensationRedeliveredConcurrently(t *testing.T) {
	const n = 25
	d := &syncDeps{}
	st := &syncStore{auditStore: auditStore{state: string(StateInventoryReserved), out: d}}
	o := NewOrchestrator(st, fakeFencer(42), d, d, d)
	var wg sync.WaitGroup
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); _ = o.Compensate(context.Background(), "B-cc", "escrow timeout") }()
	}
	wg.Wait()
	if d.releases != 1 || d.events != 1 || st.state != string(StateFailedPayment) {
		t.Fatalf("%d concurrent redeliveries: inventory.Release ran %d times, %d compensation events, final state=%s",
			n, d.releases, d.events, st.state)
	}
}
