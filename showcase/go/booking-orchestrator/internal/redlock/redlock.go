// Package redlock implements the Redlock distributed-lock protocol with
// monotonic fencing tokens and lease-renewal heartbeats, as specified by
// the KhetiRental go-systems-architect skill.
//
// Why fencing tokens: a raw Redis TTL lock is unsafe under GC pauses /
// network latency (the Kleppmann invariant). The lock token is a
// monotonically-increasing 64-bit integer minted from a Redis INCR, and the
// storage layer (PostgreSQL) validates that any write carries a fencing
// token strictly greater than the last it persisted. This makes stale lock
// holders' writes rejectable at the DB even if their lease has lapsed.
//
// Why heartbeats: a 5 s TTL is short enough to bound hold time if a holder
// crashes, but a busy booking transaction can exceed it. A background
// time.Ticker renews the lease every 2 s until the transaction completes.
package redlock

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// Lock is a Redlock lock with a monotonic fencing token.
type Lock struct {
	key       string
	token     string // random token, used for the owner-checked Lua scripts
	fencing   uint64 // monotonic per-resource fencing token
	nodes     []*redis.Client
	quorum    int
	ttl       time.Duration
	heartbeat time.Duration
	renewal   context.CancelFunc
	done      chan struct{}
	lost      chan struct{}
}

// Options configures a Redlock cluster.
type Options struct {
	Nodes      []*redis.Client
	TTL        time.Duration // default 5s
	Heartbeat  time.Duration // default 2s (must be < TTL)
	FencingKey string        // default "locks:fencing:counter"; one counter per locked key
}

// DefaultOptions returns sensible defaults per the skill spec.
func DefaultOptions(nodes []*redis.Client) Options {
	return Options{
		Nodes:      nodes,
		TTL:        5 * time.Second,
		Heartbeat:  2 * time.Second,
		FencingKey: "locks:fencing:counter",
	}
}

// Acquire tries to obtain a Redlock on key. On success it returns a Lock
// whose Release() must be called (defer it) on every code path.
func Acquire(ctx context.Context, key string, opts Options) (*Lock, error) {
	if len(opts.Nodes) == 0 {
		return nil, fmt.Errorf("redlock: no nodes")
	}
	if opts.Heartbeat <= 0 {
		opts.Heartbeat = 2 * time.Second
	}
	if opts.TTL <= 0 {
		opts.TTL = 5 * time.Second
	}
	if opts.Heartbeat >= opts.TTL {
		return nil, fmt.Errorf("redlock: heartbeat (%s) must be < ttl (%s)", opts.Heartbeat, opts.TTL)
	}
	if opts.FencingKey == "" {
		opts.FencingKey = "locks:fencing:counter"
	}
	quorum := len(opts.Nodes)/2 + 1
	lockKey := "lock:" + key
	token := randomToken()
	start := time.Now()

	// 1) Acquire the per-node locks. A node is "locked" if SET NX succeeds;
	//    an unreachable node simply doesn't count towards the quorum.
	var held []*redis.Client
	for _, n := range opts.Nodes {
		if ok, err := n.SetNX(ctx, lockKey, token, opts.TTL).Result(); err == nil && ok {
			held = append(held, n)
		}
	}
	releaseAll := func() {
		for _, n := range held {
			_ = releaseOne(ctx, n, lockKey, token)
		}
	}
	if len(held) < quorum {
		releaseAll()
		return nil, fmt.Errorf("redlock: acquired %d/%d, need quorum %d", len(held), len(opts.Nodes), quorum)
	}

	// 2) Mint the fencing token only after winning, as max(counter)+1 over
	//    the quorum we hold. Any two quorums share a node, so this exceeds
	//    every earlier holder's token even if a minority node lost its counter.
	fencing, err := mintFencing(ctx, held, quorum, opts.FencingKey+":"+key)
	if err != nil {
		releaseAll()
		return nil, err
	}

	// 3) Validity time (Redlock): if acquiring took most of the TTL, the
	//    first node's lease may already have expired; treat as not acquired.
	drift := opts.TTL/100 + 2*time.Millisecond
	if opts.TTL-time.Since(start)-drift <= 0 {
		releaseAll()
		return nil, fmt.Errorf("redlock: acquisition took %s, longer than ttl %s", time.Since(start), opts.TTL)
	}

	hbCtx, cancel := context.WithCancel(ctx)
	lock := &Lock{
		key:       lockKey,
		token:     token,
		fencing:   fencing,
		nodes:     held,
		quorum:    quorum,
		ttl:       opts.TTL,
		heartbeat: opts.Heartbeat,
		renewal:   cancel,
		done:      make(chan struct{}),
		lost:      make(chan struct{}),
	}
	go lock.heartbeatLoop(hbCtx)
	return lock, nil
}

var readCounterScript = redis.NewScript(`return tonumber(redis.call("GET", KEYS[1]) or "0")`)

var raiseCounterScript = redis.NewScript(`
local v = tonumber(redis.call("GET", KEYS[1]) or "0")
if tonumber(ARGV[1]) > v then redis.call("SET", KEYS[1], ARGV[1]) end
return 1
`)

func mintFencing(ctx context.Context, held []*redis.Client, quorum int, counterKey string) (uint64, error) {
	var max int64
	for _, n := range held {
		v, err := readCounterScript.Run(ctx, n, []string{counterKey}).Int64()
		if err != nil {
			return 0, fmt.Errorf("redlock: read fencing counter: %w", err)
		}
		if v > max {
			max = v
		}
	}
	next := max + 1
	written := 0
	for _, n := range held {
		if raiseCounterScript.Run(ctx, n, []string{counterKey}, next).Err() == nil {
			written++
		}
	}
	if written < quorum {
		return 0, fmt.Errorf("redlock: fencing token stored on %d nodes, need %d", written, quorum)
	}
	return uint64(next), nil
}

// Fencing returns the monotonic fencing token for this lock. The caller
// persists it in the DB row (fencing_token column) so a later write
// carrying a lower token is rejected.
func (l *Lock) Fencing() uint64 { return l.fencing }

// Lost is closed when the heartbeat can no longer renew the lease on a
// quorum (another holder took over, or the lease lapsed). Stop writing then.
func (l *Lock) Lost() <-chan struct{} { return l.lost }

// Release deterministically deletes the lock only if we still own it
// (Lua guarded delete), then stops the heartbeat.
func (l *Lock) Release(ctx context.Context) {
	if l == nil {
		return
	}
	if l.renewal != nil {
		l.renewal()
		<-l.done
	}
	for _, n := range l.nodes {
		_ = releaseOne(ctx, n, l.key, l.token)
	}
}

// WithLock owns the lock lifecycle for one unit of work (e.g. a booking
// saga): it acquires, runs fn with a context that is cancelled if the lease
// is lost, and releases on every path, including a panic in fn.
func WithLock(ctx context.Context, key string, opts Options, fn func(context.Context, *Lock) error) error {
	l, err := Acquire(ctx, key, opts)
	if err != nil {
		return err
	}
	defer l.Release(context.WithoutCancel(ctx))
	work, cancel := context.WithCancel(ctx)
	defer cancel()
	go func() {
		select {
		case <-l.Lost():
			cancel()
		case <-work.Done():
		}
	}()
	return fn(work, l)
}

// ReleaseForced is used on the compensating path where the lease may have
// already lapsed; it still attempts the guarded delete.
func (l *Lock) ReleaseForced(ctx context.Context) { l.Release(ctx) }

var renewScript = redis.NewScript(`
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("PEXPIRE", KEYS[1], ARGV[2])
else
    return 0
end
`)

// heartbeatLoop renews the lease on every node we still own; once fewer
// than a quorum renew, the lock is lost and the loop stops.
func (l *Lock) heartbeatLoop(ctx context.Context) {
	defer close(l.done)
	ticker := time.NewTicker(l.heartbeat)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			renewed := 0
			for _, n := range l.nodes {
				if ok, err := renewScript.Run(ctx, n, []string{l.key}, l.token, l.ttl.Milliseconds()).Int(); err == nil && ok == 1 {
					renewed++
				}
			}
			if renewed < l.quorum && ctx.Err() == nil {
				close(l.lost)
				return
			}
		}
	}
}

// releaseScript runs the Lua "delete only if value matches" script.
var releaseScript = redis.NewScript(`
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
else
    return 0
end
`)

func releaseOne(ctx context.Context, n *redis.Client, key, token string) error {
	return releaseScript.Run(ctx, n, []string{key}, token).Err()
}

// randomToken returns a 32-hex-char random string for lock ownership.
func randomToken() string {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		// Fallback: time-seeded (should not happen on a healthy host).
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(buf)
}
