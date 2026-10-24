package redlock

// Phase 1 invariant audit (docs/audit/phase1-invariant-audit.md).
// TestAudit_* tests are RED by design: each fails against today's code and
// passes once the corresponding remediation lands. Redis DBs 14-15 on
// 127.0.0.1:6390; Postgres 127.0.0.1:5440 (throwaway database). Both skip
// when unreachable.

import (
	"context"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/redis/go-redis/v9"
)

func auditRedisAddr() string {
	if a := os.Getenv("REDIS_TEST_ADDR"); a != "" {
		return a
	}
	return "127.0.0.1:6390"
}

// auditNodes returns two Redlock nodes (DBs 14 and 15), flushed before and after.
func auditNodes(t *testing.T, hooks ...redis.Hook) []*redis.Client {
	t.Helper()
	ctx := context.Background()
	var nodes []*redis.Client
	for db := 14; db <= 15; db++ {
		n := redis.NewClient(&redis.Options{Addr: auditRedisAddr(), DB: db})
		if err := n.Ping(ctx).Err(); err != nil {
			t.Skipf("integration: redis unreachable: %v", err)
		}
		n.FlushDB(ctx)
		for _, h := range hooks {
			n.AddHook(h)
		}
		nodes = append(nodes, n)
	}
	t.Cleanup(func() {
		for _, n := range nodes {
			n.FlushDB(context.Background())
			n.Close()
		}
	})
	return nodes
}

// auditPG creates a throwaway database, applies deploy/sql/*.sql and drops it after.
func auditPG(t *testing.T) *pgx.Conn {
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
	db := fmt.Sprintf("audit_fencing_%d", time.Now().UnixNano())
	if _, err := admin.Exec(ctx, "CREATE DATABASE "+db); err != nil {
		admin.Close(ctx)
		t.Fatalf("create db: %v", err)
	}
	cfg, _ := pgx.ParseConfig(base)
	cfg.Database = db
	conn, err := pgx.ConnectConfig(ctx, cfg)
	if err != nil {
		t.Fatalf("connect %s: %v", db, err)
	}
	t.Cleanup(func() {
		conn.Close(ctx)
		_, _ = admin.Exec(ctx, "DROP DATABASE IF EXISTS "+db+" WITH (FORCE)")
		admin.Close(ctx)
	})
	files, _ := filepath.Glob("../../../../deploy/sql/*.sql")
	sort.Strings(files)
	if len(files) == 0 {
		t.Fatal("no deploy/sql/*.sql found")
	}
	for _, f := range files {
		b, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := conn.Exec(ctx, string(b)); err != nil {
			t.Fatalf("apply %s: %v", f, err)
		}
	}
	return conn
}

// createBooking mirrors pgstore.Store.CreateBooking: row starts at the creator's token.
func createBooking(t *testing.T, c *pgx.Conn, id string, fencing uint64) {
	t.Helper()
	_, err := c.Exec(context.Background(),
		`INSERT INTO bookings (booking_id, machine_id, renter_id, idempotency_key, state, fencing_token)
		 VALUES ($1, 'M-1', 'R-1', $1, 'PENDING', $2)`, id, int64(fencing))
	if err != nil {
		t.Fatal(err)
	}
}

// transition executes the shipped TransitionSQL and returns rows affected.
func transition(t *testing.T, c *pgx.Conn, id, state string, fencing uint64) int64 {
	t.Helper()
	q, args := NewSQLFencedBookingStore().TransitionSQL(id, state, fencing)
	args[2] = int64(fencing)
	tag, err := c.Exec(context.Background(), q, args...)
	if err != nil {
		t.Fatal(err)
	}
	return tag.RowsAffected()
}

// Invariant 1, core scenario: holder A pauses (GC) past its lease, B acquires
// with a higher token and writes, A resumes and writes. A must be rejected
// at the DB and B's write must stand.
func TestAudit_Fencing_GCPauseStaleWriteRejected(t *testing.T) {
	ctx := context.Background()
	pg := auditPG(t)
	opts := DefaultOptions(auditNodes(t))
	opts.TTL, opts.Heartbeat = 300*time.Millisecond, 100*time.Millisecond // 5 s / 2 s scaled 1:~16

	a, err := Acquire(ctx, "machine:M-1", opts)
	if err != nil {
		t.Fatal(err)
	}
	createBooking(t, pg, "B-gc", a.Fencing())

	// GC pause: the whole process freezes, heartbeat included.
	a.renewal()
	<-a.done
	time.Sleep(2 * opts.TTL)

	b, err := Acquire(ctx, "machine:M-1", opts)
	if err != nil {
		t.Fatalf("B could not acquire after A's lease lapsed: %v", err)
	}
	defer b.Release(ctx)
	if b.Fencing() <= a.Fencing() {
		t.Fatalf("fencing not monotonic: A=%d B=%d", a.Fencing(), b.Fencing())
	}

	bRows := transition(t, pg, "B-gc", "INVENTORY_RESERVED", b.Fencing())
	aRows := transition(t, pg, "B-gc", "FAILED_INVENTORY", a.Fencing()) // A resumes with its stale token

	var state string
	var tok int64
	_ = pg.QueryRow(ctx, `SELECT state, fencing_token FROM bookings WHERE booking_id='B-gc'`).Scan(&state, &tok)
	if bRows != 1 || aRows != 0 || state != "INVENTORY_RESERVED" {
		t.Fatalf("stale write not rejected: B(token %d) rows=%d, A(token %d, stale) rows=%d, final state=%s token=%d",
			b.Fencing(), bRows, a.Fencing(), aRows, state, tok)
	}
}

// The saga issues several transitions under one lock (saga.go:142,153,161).
// Every one of them must succeed for the current holder.
func TestAudit_Fencing_SameHolderSecondTransition(t *testing.T) {
	pg := auditPG(t)
	const tok = 7
	createBooking(t, pg, "B-2", tok)
	r1 := transition(t, pg, "B-2", "INVENTORY_RESERVED", tok)
	r2 := transition(t, pg, "B-2", "ESCROW_AUTHORIZED", tok)
	if r1 != 1 || r2 != 1 {
		t.Fatalf("current holder locked out of its own row: first rows=%d second rows=%d", r1, r2)
	}
}

// Heartbeat must not extend a key it no longer owns (redlock.go:160).
func TestAudit_Heartbeat_DoesNotExtendLostLock(t *testing.T) {
	ctx := context.Background()
	nodes := auditNodes(t)
	opts := DefaultOptions(nodes)
	opts.TTL, opts.Heartbeat = 300*time.Millisecond, 100*time.Millisecond
	l, err := Acquire(ctx, "k", opts)
	if err != nil {
		t.Fatal(err)
	}
	defer l.Release(ctx)
	// A's lease lapsed; B now owns the key with its own 400 ms lease.
	for _, n := range nodes {
		n.Set(ctx, "lock:k", "holder-B", 400*time.Millisecond)
	}
	time.Sleep(time.Second)
	for i, n := range nodes {
		if n.Exists(ctx, "lock:k").Val() == 1 {
			t.Fatalf("node %d: B's 400 ms lease still alive after 1 s; A's heartbeat (value %q) kept extending a lock it lost",
				i, n.Get(ctx, "lock:k").Val())
		}
	}
}

// The fencing counter lives only on Nodes[0] (redlock.go:80). Losing its
// state (failover to a non-persisted replica) must not reissue old tokens.
func TestAudit_Fencing_MonotonicAfterNode0Reset(t *testing.T) {
	ctx := context.Background()
	nodes := auditNodes(t)
	opts := DefaultOptions(nodes)
	a, err := Acquire(ctx, "k", opts)
	if err != nil {
		t.Fatal(err)
	}
	a.Release(ctx)
	nodes[0].FlushDB(ctx) // node 0 fails over without the counter
	b, err := Acquire(ctx, "k", opts)
	if err != nil {
		t.Fatal(err)
	}
	defer b.Release(ctx)
	if b.Fencing() <= a.Fencing() {
		t.Fatalf("fencing token regressed after node-0 reset: A=%d B=%d", a.Fencing(), b.Fencing())
	}
}

// With a majority of nodes healthy, Redlock must still grant the lock even
// if Nodes[0] is down.
func TestAudit_Fencing_Node0DownStillAcquires(t *testing.T) {
	ctx := context.Background()
	healthy := auditNodes(t)
	ln, err := net.Listen("tcp", "127.0.0.1:0") // grab a port, then close it: guaranteed refused
	if err != nil {
		t.Fatal(err)
	}
	dead := ln.Addr().String()
	ln.Close()
	down := redis.NewClient(&redis.Options{Addr: dead, DialTimeout: 100 * time.Millisecond, MaxRetries: -1})
	defer down.Close()
	opts := DefaultOptions(append([]*redis.Client{down}, healthy...)) // quorum 2 of 3, 2 healthy
	l, err := Acquire(ctx, "k", opts)
	if err != nil {
		t.Fatalf("2/3 nodes healthy but Acquire failed: %v", err)
	}
	l.Release(ctx)
}

type slowHook struct{ d time.Duration }

func (h slowHook) DialHook(next redis.DialHook) redis.DialHook { return next }
func (h slowHook) ProcessHook(next redis.ProcessHook) redis.ProcessHook {
	return func(ctx context.Context, cmd redis.Cmder) error {
		time.Sleep(h.d)
		return next(ctx, cmd)
	}
}
func (h slowHook) ProcessPipelineHook(next redis.ProcessPipelineHook) redis.ProcessPipelineHook {
	return next
}

// Redlock validity: if acquiring the quorum took longer than the TTL (minus
// clock drift), the lock must be treated as not acquired.
func TestAudit_Redlock_ValidityTimeCheckedAfterQuorum(t *testing.T) {
	ctx := context.Background()
	nodes := auditNodes(t, slowHook{d: 200 * time.Millisecond})
	opts := DefaultOptions(nodes)
	opts.TTL, opts.Heartbeat = 300*time.Millisecond, 100*time.Millisecond
	start := time.Now()
	l, err := Acquire(ctx, "k", opts)
	elapsed := time.Since(start)
	if err == nil {
		l.Release(ctx)
		t.Fatalf("Acquire returned a lock after %s against a %s TTL; validity time was never checked", elapsed, opts.TTL)
	}
}

// 50 goroutines race Acquire on one machine key. At most one holder at any
// instant, and each successive holder must carry a strictly larger token.
func TestAudit_Concurrency_FiftyRacersOneHolder(t *testing.T) {
	ctx := context.Background()
	opts := DefaultOptions(auditNodes(t))
	var (
		mu      sync.Mutex
		inside  int32
		maxIn   int32
		tokens  []uint64
		wg      sync.WaitGroup
		failure atomic.Int32
	)
	deadline := time.Now().Add(20 * time.Second)
	for g := 0; g < 50; g++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for time.Now().Before(deadline) {
				l, err := Acquire(ctx, "machine:M-race", opts)
				if err != nil {
					time.Sleep(time.Millisecond)
					continue
				}
				n := atomic.AddInt32(&inside, 1)
				mu.Lock()
				if n > maxIn {
					maxIn = n
				}
				tokens = append(tokens, l.Fencing()) // order of entry into the critical section
				mu.Unlock()
				time.Sleep(2 * time.Millisecond)
				atomic.AddInt32(&inside, -1)
				l.Release(ctx)
				return
			}
			failure.Add(1)
		}()
	}
	wg.Wait()
	if failure.Load() > 0 {
		t.Fatalf("%d racers never acquired within 20 s", failure.Load())
	}
	if maxIn > 1 {
		t.Fatalf("mutual exclusion broken: %d simultaneous holders", maxIn)
	}
	inversions := 0
	for i := 1; i < len(tokens); i++ {
		if tokens[i] <= tokens[i-1] {
			inversions++
		}
	}
	if inversions > 0 {
		t.Fatalf("%d of %d successive holders received a SMALLER fencing token than the previous holder (token minted before SET NX, redlock.go:80-96); first 10 in entry order: %v",
			inversions, len(tokens)-1, tokens[:10])
	}
}

// Many holders write the same booking row concurrently; the newest token
// arrives first, then every older (GC-paused) holder fires at once. Only the
// newest write may stand.
func TestAudit_Concurrency_StaleTokensArriveAfterNewest(t *testing.T) {
	ctx := context.Background()
	pg := auditPG(t)
	const holders = 20
	createBooking(t, pg, "B-race", 1) // row created by holder 1
	newest := transition(t, pg, "B-race", "INVENTORY_RESERVED", holders)

	var wg sync.WaitGroup
	var accepted atomic.Int32
	for tok := uint64(1); tok < holders; tok++ {
		wg.Add(1)
		go func(tok uint64) {
			defer wg.Done()
			c, err := pgx.ConnectConfig(ctx, pg.Config())
			if err != nil {
				t.Error(err)
				return
			}
			defer c.Close(ctx)
			q, args := NewSQLFencedBookingStore().TransitionSQL("B-race", "FAILED_INVENTORY", tok)
			args[2] = int64(tok)
			tag, err := c.Exec(ctx, q, args...)
			if err != nil {
				t.Error(err)
				return
			}
			accepted.Add(int32(tag.RowsAffected()))
		}(tok)
	}
	wg.Wait()
	var state string
	_ = pg.QueryRow(ctx, `SELECT state FROM bookings WHERE booking_id='B-race'`).Scan(&state)
	if newest != 1 || accepted.Load() != 0 || state != "INVENTORY_RESERVED" {
		t.Fatalf("newest holder (token %d) rows=%d; stale writes accepted=%d of %d; final state=%s",
			holders, newest, accepted.Load(), holders-1, state)
	}
}

// stallSetNX delays only SET commands: the racer has minted its token (INCR)
// but not yet locked, as under a scheduler or GC stall.
type stallSetNX struct{ d time.Duration }

func (h stallSetNX) DialHook(next redis.DialHook) redis.DialHook { return next }
func (h stallSetNX) ProcessHook(next redis.ProcessHook) redis.ProcessHook {
	return func(ctx context.Context, cmd redis.Cmder) error {
		if cmd.Name() == "set" {
			time.Sleep(h.d)
		}
		return next(ctx, cmd)
	}
}
func (h stallSetNX) ProcessPipelineHook(next redis.ProcessPipelineHook) redis.ProcessPipelineHook {
	return next
}

// Deterministic interleaving of the race above: X mints a token, stalls,
// Y acquires+releases with a newer token, X then locks. X is the newest
// holder but carries an older token than its predecessor.
func TestAudit_Concurrency_TokenMintedBeforeLockInverts(t *testing.T) {
	ctx := context.Background()
	fast := auditNodes(t)
	var slow []*redis.Client
	for db := 14; db <= 15; db++ {
		c := redis.NewClient(&redis.Options{Addr: auditRedisAddr(), DB: db})
		c.AddHook(stallSetNX{d: 150 * time.Millisecond})
		defer c.Close()
		slow = append(slow, c)
	}
	xc := make(chan *Lock, 1)
	go func() {
		l, err := Acquire(ctx, "k", DefaultOptions(slow))
		if err != nil {
			t.Error(err)
		}
		xc <- l
	}()
	time.Sleep(30 * time.Millisecond) // X has INCRed and is stalled before SET NX
	y, err := Acquire(ctx, "k", DefaultOptions(fast))
	if err != nil {
		t.Fatal(err)
	}
	y.Release(ctx)
	x := <-xc
	if x == nil {
		t.Fatal("X never acquired")
	}
	defer x.Release(ctx)
	if x.Fencing() <= y.Fencing() {
		t.Fatalf("successor X holds the lock with token %d, older than predecessor Y's %d", x.Fencing(), y.Fencing())
	}
}
