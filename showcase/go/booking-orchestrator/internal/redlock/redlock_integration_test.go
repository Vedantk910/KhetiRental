package redlock

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
)

// testNodes returns three Redlock "nodes" (logical DBs 11-13 on one Redis),
// flushed before and after. Skips when Redis is unreachable.
func testNodes(t *testing.T) []*redis.Client {
	t.Helper()
	addr := os.Getenv("REDIS_TEST_ADDR")
	if addr == "" {
		addr = "127.0.0.1:6390"
	}
	ctx := context.Background()
	var nodes []*redis.Client
	for db := 11; db <= 13; db++ {
		n := redis.NewClient(&redis.Options{Addr: addr, DB: db})
		if err := n.Ping(ctx).Err(); err != nil {
			t.Skipf("integration: redis %s unreachable: %v", addr, err)
		}
		n.FlushDB(ctx)
		nodes = append(nodes, n)
	}
	t.Cleanup(func() {
		for _, n := range nodes {
			n.FlushDB(ctx)
			n.Close()
		}
	})
	return nodes
}

func TestAcquireIsExclusiveAndFencingIsMonotonic(t *testing.T) {
	ctx := context.Background()
	opts := DefaultOptions(testNodes(t))

	a, err := Acquire(ctx, "machine:M-1", opts)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := Acquire(ctx, "machine:M-1", opts); err == nil {
		t.Fatal("second holder acquired a held lock")
	}
	a.Release(ctx)

	b, err := Acquire(ctx, "machine:M-1", opts)
	if err != nil {
		t.Fatalf("re-acquire after release: %v", err)
	}
	defer b.Release(ctx)
	if b.Fencing() <= a.Fencing() {
		t.Fatalf("fencing not monotonic: first=%d second=%d", a.Fencing(), b.Fencing())
	}
}

func TestReleaseOnlyDeletesOwnLock(t *testing.T) {
	ctx := context.Background()
	nodes := testNodes(t)
	l, err := Acquire(ctx, "k", DefaultOptions(nodes))
	if err != nil {
		t.Fatal(err)
	}
	// Lease lapsed and another process now owns the key on every node.
	for _, n := range nodes {
		n.Set(ctx, "lock:k", "someone-else", time.Minute)
	}
	l.Release(ctx)
	for i, n := range nodes {
		if v := n.Get(ctx, "lock:k").Val(); v != "someone-else" {
			t.Fatalf("node %d: stale holder deleted the new owner's lock (value %q)", i, v)
		}
	}
}

func TestNoQuorumFailsAndLeaksNothing(t *testing.T) {
	ctx := context.Background()
	nodes := testNodes(t)
	// Two of three nodes already locked by someone else → quorum (2) impossible.
	nodes[0].Set(ctx, "lock:k", "other", time.Minute)
	nodes[1].Set(ctx, "lock:k", "other", time.Minute)
	if _, err := Acquire(ctx, "k", DefaultOptions(nodes)); err == nil {
		t.Fatal("acquired without quorum")
	}
	if nodes[2].Exists(ctx, "lock:k").Val() != 0 {
		t.Fatal("minority lock on node 2 not rolled back")
	}
}

func TestHeartbeatRenewsLeaseUntilRelease(t *testing.T) {
	ctx := context.Background()
	nodes := testNodes(t)
	opts := DefaultOptions(nodes)
	opts.TTL, opts.Heartbeat = 300*time.Millisecond, 100*time.Millisecond

	l, err := Acquire(ctx, "k", opts)
	if err != nil {
		t.Fatal(err)
	}
	time.Sleep(3 * opts.TTL) // well past the original TTL
	for i, n := range nodes {
		if n.Exists(ctx, "lock:k").Val() != 1 {
			t.Fatalf("node %d: lease expired despite heartbeat", i)
		}
	}
	l.Release(ctx)
	for i, n := range nodes {
		if n.Exists(ctx, "lock:k").Val() != 0 {
			t.Fatalf("node %d: lock still present after release", i)
		}
	}
}

func TestAcquireValidatesOptions(t *testing.T) {
	ctx := context.Background()
	if _, err := Acquire(ctx, "k", Options{}); err == nil {
		t.Fatal("no nodes accepted")
	}
	opts := DefaultOptions(testNodes(t))
	opts.Heartbeat = opts.TTL
	if _, err := Acquire(ctx, "k", opts); err == nil {
		t.Fatal("heartbeat >= ttl accepted")
	}
}

func TestApplyTransitionRejectsZeroRows(t *testing.T) {
	s := NewSQLFencedBookingStore()
	if err := s.ApplyTransition(0); !errors.Is(err, ErrStaleFencing) {
		t.Fatalf("0 rows: got %v want ErrStaleFencing", err)
	}
	if err := s.ApplyTransition(1); err != nil {
		t.Fatalf("1 row: %v", err)
	}
}

// A holder whose lease is taken over must be told, so it stops writing.
func TestLostSignalsWhenQuorumCannotRenew(t *testing.T) {
	ctx := context.Background()
	nodes := testNodes(t)
	opts := DefaultOptions(nodes)
	opts.TTL, opts.Heartbeat = 300*time.Millisecond, 50*time.Millisecond
	l, err := Acquire(ctx, "k", opts)
	if err != nil {
		t.Fatal(err)
	}
	defer l.Release(ctx)
	select {
	case <-l.Lost():
		t.Fatal("Lost fired while the lease is healthy")
	case <-time.After(200 * time.Millisecond):
	}
	for _, n := range nodes {
		n.Set(ctx, "lock:k", "someone-else", time.Minute)
	}
	select {
	case <-l.Lost():
	case <-time.After(time.Second):
		t.Fatal("Lost never fired after another holder took every node")
	}
}

// Successive holders get strictly increasing tokens even when a minority of
// nodes loses its counter between them (quorums always overlap).
func TestFencingSurvivesMinorityCounterLoss(t *testing.T) {
	ctx := context.Background()
	nodes := testNodes(t)
	var last uint64
	for i := 0; i < 5; i++ {
		l, err := Acquire(ctx, "k", DefaultOptions(nodes))
		if err != nil {
			t.Fatal(err)
		}
		if l.Fencing() <= last {
			t.Fatalf("round %d: token %d not above previous %d", i, l.Fencing(), last)
		}
		last = l.Fencing()
		l.Release(ctx)
		nodes[i%len(nodes)].FlushDB(ctx) // a different minority node forgets each round
	}
}

// WithLock releases the lock on every path: success, error and panic.
func TestWithLockReleasesOnEveryPath(t *testing.T) {
	ctx := context.Background()
	nodes := testNodes(t)
	free := func() bool {
		return nodes[0].Exists(ctx, "lock:k").Val() == 0 && nodes[1].Exists(ctx, "lock:k").Val() == 0
	}

	if err := WithLock(ctx, "k", DefaultOptions(nodes), func(context.Context, *Lock) error { return nil }); err != nil || !free() {
		t.Fatalf("success path: err=%v lock free=%v", err, free())
	}
	boom := errors.New("authorize failed")
	if err := WithLock(ctx, "k", DefaultOptions(nodes), func(context.Context, *Lock) error { return boom }); !errors.Is(err, boom) || !free() {
		t.Fatalf("error path: err=%v lock free=%v", err, free())
	}
	func() {
		defer func() { _ = recover() }()
		_ = WithLock(ctx, "k", DefaultOptions(nodes), func(context.Context, *Lock) error { panic("provider SDK panicked") })
	}()
	if !free() {
		t.Fatal("panic path left a ghost lock")
	}
}

// When the lease is lost mid-work, the work's context is cancelled.
func TestWithLockCancelsWorkWhenLost(t *testing.T) {
	ctx := context.Background()
	nodes := testNodes(t)
	opts := DefaultOptions(nodes)
	opts.TTL, opts.Heartbeat = 300*time.Millisecond, 50*time.Millisecond
	err := WithLock(ctx, "k", opts, func(work context.Context, _ *Lock) error {
		for _, n := range nodes {
			n.Set(ctx, "lock:k", "someone-else", time.Minute)
		}
		select {
		case <-work.Done():
			return work.Err()
		case <-time.After(2 * time.Second):
			return errors.New("work kept running after the lock was lost")
		}
	})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("err=%v, want context.Canceled", err)
	}
}
