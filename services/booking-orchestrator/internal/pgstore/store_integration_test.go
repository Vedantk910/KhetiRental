package pgstore

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/khetirental/booking-orchestrator/internal/saga"
)

// testDB creates a throwaway database with deploy/sql applied and drops it
// after. Skips when Postgres is unreachable (PG_TEST_DSN, default :5440).
func testDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	ctx := context.Background()
	base := os.Getenv("PG_TEST_DSN")
	if base == "" {
		base = "postgres://postgres@127.0.0.1:5440/postgres?sslmode=disable"
	}
	admin, err := pgx.Connect(ctx, base)
	if err != nil {
		t.Skipf("integration: postgres unreachable: %v", err)
	}
	name := fmt.Sprintf("pgstore_%d", time.Now().UnixNano())
	if _, err := admin.Exec(ctx, "CREATE DATABASE "+name); err != nil {
		t.Fatal(err)
	}
	cfg, _ := pgxpool.ParseConfig(base)
	cfg.ConnConfig.Database = name
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		pool.Close()
		_, _ = admin.Exec(ctx, "DROP DATABASE IF EXISTS "+name+" WITH (FORCE)")
		admin.Close(ctx)
	})
	files, _ := filepath.Glob("../../../../deploy/sql/*.sql")
	sort.Strings(files)
	for _, f := range files {
		b, _ := os.ReadFile(f)
		if _, err := pool.Exec(ctx, string(b)); err != nil {
			t.Fatalf("apply %s: %v", f, err)
		}
	}
	return pool
}

func ev(id string) saga.OutboxEvent {
	return saga.OutboxEvent{AggID: id, Stream: "booking", Topic: "booking.events", Data: []byte(`{"booking_id":"` + id + `"}`)}
}

func row(t *testing.T, db *pgxpool.Pool, id string) (state string, token int64, outbox int) {
	t.Helper()
	ctx := context.Background()
	if err := db.QueryRow(ctx, `SELECT state, fencing_token FROM bookings WHERE booking_id=$1`, id).Scan(&state, &token); err != nil {
		t.Fatal(err)
	}
	_ = db.QueryRow(ctx, `SELECT count(*) FROM outbox_events WHERE aggregate_id=$1`, id).Scan(&outbox)
	return
}

func TestTransitionCommitsStateAndOutboxTogether(t *testing.T) {
	ctx := context.Background()
	db := testDB(t)
	s := New(db)
	if err := s.CreateBooking(ctx, "B-1", "M-1", "R-1", "idem-1", 5); err != nil {
		t.Fatal(err)
	}
	n, err := s.TransitionState(ctx, "B-1", "INVENTORY_RESERVED", 5, ev("B-1"))
	if err != nil || n != 1 {
		t.Fatalf("rows=%d err=%v", n, err)
	}
	if st, tok, out := row(t, db, "B-1"); st != "INVENTORY_RESERVED" || tok != 5 || out != 1 {
		t.Fatalf("state=%s token=%d outbox rows=%d", st, tok, out)
	}
	// Same holder, next step, then a newer holder.
	if n, _ := s.TransitionState(ctx, "B-1", "ESCROW_AUTHORIZED", 5, ev("B-1")); n != 1 {
		t.Fatal("current holder could not make its second transition")
	}
	if n, _ := s.TransitionState(ctx, "B-1", "DISPATCHED", 9, ev("B-1")); n != 1 {
		t.Fatal("newer holder rejected")
	}
	if st, tok, out := row(t, db, "B-1"); st != "DISPATCHED" || tok != 9 || out != 3 {
		t.Fatalf("state=%s token=%d outbox rows=%d", st, tok, out)
	}
}

func TestOutboxFailureRollsBackState(t *testing.T) {
	ctx := context.Background()
	db := testDB(t)
	s := New(db)
	_ = s.CreateBooking(ctx, "B-2", "M-1", "R-1", "idem-2", 1)
	bad := ev("B-2")
	bad.Data = nil // violates outbox_events.data NOT NULL
	if n, err := s.TransitionState(ctx, "B-2", "INVENTORY_RESERVED", 1, bad); err == nil || n != 0 {
		t.Fatalf("outbox insert failed but rows=%d err=%v", n, err)
	}
	if st, _, out := row(t, db, "B-2"); st != "PENDING" || out != 0 {
		t.Fatalf("state committed without its event: state=%s outbox=%d", st, out)
	}
}

func TestStaleSameStateAndTerminalAreNoOps(t *testing.T) {
	ctx := context.Background()
	db := testDB(t)
	s := New(db)
	_ = s.CreateBooking(ctx, "B-3", "M-1", "R-1", "idem-3", 10)
	for _, c := range []struct {
		name  string
		state string
		tok   uint64
		want  int
	}{
		{"stale token", "INVENTORY_RESERVED", 9, 0},
		{"valid", "INVENTORY_RESERVED", 10, 1},
		{"same state again", "INVENTORY_RESERVED", 10, 0},
		{"to terminal", "FAILED_PAYMENT_RELEASED", 10, 1},
		{"out of terminal", "DISPATCHED", 11, 0},
		{"terminal again", "FAILED_PAYMENT_RELEASED", 11, 0},
	} {
		n, err := s.TransitionState(ctx, "B-3", c.state, c.tok, ev("B-3"))
		if err != nil || n != c.want {
			t.Fatalf("%s: rows=%d err=%v want %d", c.name, n, err, c.want)
		}
	}
	if _, _, out := row(t, db, "B-3"); out != 2 {
		t.Fatalf("outbox rows=%d, want one per accepted transition (2)", out)
	}
}

// 20 holders (tokens 1..20) race transitions on one booking. Whatever the
// interleaving: every accepted transition has exactly one outbox row, no
// rejected one has any, and the row ends stamped with the largest accepted token.
func TestConcurrentHoldersNeverDesyncStateAndOutbox(t *testing.T) {
	ctx := context.Background()
	db := testDB(t)
	s := New(db)
	_ = s.CreateBooking(ctx, "B-4", "M-1", "R-1", "idem-4", 0)
	states := []string{"INVENTORY_RESERVED", "ESCROW_AUTHORIZED", "DISPATCHED", "TELEMATICS_ACTIVE"}
	var accepted atomic.Int32
	var maxTok atomic.Int64
	var wg sync.WaitGroup
	for tok := 1; tok <= 20; tok++ {
		for _, st := range states {
			wg.Add(1)
			go func(tok int, st string) {
				defer wg.Done()
				n, err := s.TransitionState(ctx, "B-4", st, uint64(tok), ev("B-4"))
				if err != nil {
					t.Error(err)
					return
				}
				if n == 1 {
					accepted.Add(1)
					for {
						cur := maxTok.Load()
						if int64(tok) <= cur || maxTok.CompareAndSwap(cur, int64(tok)) {
							break
						}
					}
				}
			}(tok, st)
		}
	}
	wg.Wait()
	_, token, out := row(t, db, "B-4")
	if int32(out) != accepted.Load() || token != maxTok.Load() {
		t.Fatalf("accepted=%d outbox rows=%d; final token=%d, largest accepted=%d", accepted.Load(), out, token, maxTok.Load())
	}
}

type countDeps struct{ releases, voids atomic.Int32 }

func (d *countDeps) Reserve(context.Context, string) error    { return nil }
func (d *countDeps) Release(context.Context, string) error    { d.releases.Add(1); return nil }
func (d *countDeps) Authorize(context.Context, string) error  { return nil }
func (d *countDeps) Compensate(context.Context, string) error { d.voids.Add(1); return nil }
func (d *countDeps) Dispatch(context.Context, string) error   { return nil }

type token uint64

func (f token) Fencing() uint64 { return uint64(f) }

// End to end against Postgres: one compensation event redelivered 25 times
// concurrently releases the machine and voids escrow exactly once.
func TestCompensationRedeliveryAgainstPostgres(t *testing.T) {
	ctx := context.Background()
	db := testDB(t)
	s := New(db)
	_ = s.CreateBooking(ctx, "B-5", "M-1", "R-1", "idem-5", 3)
	if n, _ := s.TransitionState(ctx, "B-5", "INVENTORY_RESERVED", 3, ev("B-5")); n != 1 {
		t.Fatal("setup transition failed")
	}
	d := &countDeps{}
	o := saga.NewOrchestrator(s, token(3), d, d, d)
	var wg sync.WaitGroup
	for i := 0; i < 25; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); _ = o.Compensate(ctx, "B-5", "escrow timeout") }()
	}
	wg.Wait()
	st, _, out := row(t, db, "B-5")
	if d.releases.Load() != 1 || d.voids.Load() != 1 || st != "FAILED_PAYMENT_RELEASED" || out != 2 {
		t.Fatalf("releases=%d voids=%d state=%s outbox=%d (want 1, 1, FAILED_PAYMENT_RELEASED, 2)",
			d.releases.Load(), d.voids.Load(), st, out)
	}
}
