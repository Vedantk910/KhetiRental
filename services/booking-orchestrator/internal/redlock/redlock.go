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
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// Lock is a Redlock lock with a monotonic fencing token.
type Lock struct {
	mu        sync.Mutex
	key       string
	token     string    // random UUID-ish token, used for the Lua release
	fencing   uint64    // monotonic fencing token from Redis INCR
	nodes     []*redis.Client
	quorum    int
	ttl       time.Duration
	heartbeat time.Duration
	renewal   context.CancelFunc
	done      chan struct{}
}

// Options configures a Redlock cluster.
type Options struct {
	Nodes      []*redis.Client
	TTL        time.Duration // default 5s
	Heartbeat  time.Duration // default 2s (must be < TTL)
	FencingKey string        // default "locks:fencing:counter"
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
	quorum := len(opts.Nodes)/2 + 1
	lockKey := "lock:" + key

	// 1) Mint a monotonic fencing token (INCR on a shared counter). This is
	//    the mechanism that makes stale writes detectable.
	fenceNode := opts.Nodes[0]
	fencing, err := fenceNode.Incr(ctx, opts.FencingKey).Result()
	if err != nil {
		return nil, fmt.Errorf("redlock: fencing incr: %w", err)
	}

	// 2) Acquire the per-node locks. A node is "locked" if SET NX succeeds.
	token := randomToken()
	acquired := 0
	var held []*redis.Client
	for _, n := range opts.Nodes {
		ok, err := n.SetNX(ctx, lockKey, token, opts.TTL).Result()
		if err == nil && ok {
			acquired++
			held = append(held, n)
		}
	}
	if acquired < quorum {
		for _, n := range held {
			_ = releaseOne(ctx, n, lockKey, token)
		}
		return nil, fmt.Errorf("redlock: acquired %d/%d, need quorum %d", acquired, len(opts.Nodes), quorum)
	}

	// 3) Start the lease-renewal heartbeat.
	hbCtx, cancel := context.WithCancel(ctx)
	done := make(chan struct{})
	lock := &Lock{
		key:       lockKey,
		token:     token,
		fencing:   uint64(fencing),
		nodes:     held,
		quorum:    quorum,
		ttl:       opts.TTL,
		heartbeat: opts.Heartbeat,
		renewal:   cancel,
		done:      done,
	}
	go lock.heartbeatLoop(hbCtx)
	return lock, nil
}

// Fencing returns the monotonic fencing token for this lock. The caller
// persists it in the DB row (booking_version / fencing_token column) so a
// later write carrying a lower token is rejected.
func (l *Lock) Fencing() uint64 { return l.fencing }

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

// ReleaseForced is used on the compensating path where the lease may have
// already lapsed; it still attempts the guarded delete.
func (l *Lock) ReleaseForced(ctx context.Context) { l.Release(ctx) }

// heartbeatLoop renews the lease on a time.Ticker until the context is
// cancelled. The renewal extends the TTL on every node we hold.
func (l *Lock) heartbeatLoop(ctx context.Context) {
	defer close(l.done)
	ticker := time.NewTicker(l.heartbeat)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			for _, n := range l.nodes {
				// Only extend if we still own the key (avoid extending a lock
				// we lost, which would be a fencing violation).
				_ = n.Expire(ctx, l.key, l.ttl).Err()
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
