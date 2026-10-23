package h3geo

import (
	"context"
	"os"
	"sort"
	"testing"

	"github.com/redis/go-redis/v9"
)

// testRedis returns a client on a scratch DB, flushed before and after the
// test. It skips when no Redis is reachable (REDIS_TEST_ADDR, default :6390).
func testRedis(t *testing.T) *redis.Client {
	t.Helper()
	addr := os.Getenv("REDIS_TEST_ADDR")
	if addr == "" {
		addr = "127.0.0.1:6390"
	}
	rdb := redis.NewClient(&redis.Options{Addr: addr, DB: 9})
	ctx := context.Background()
	if err := rdb.Ping(ctx).Err(); err != nil {
		t.Skipf("integration: redis %s unreachable: %v", addr, err)
	}
	rdb.FlushDB(ctx)
	t.Cleanup(func() { rdb.FlushDB(ctx); rdb.Close() })
	return rdb
}

func ids(ms []Machine) []string {
	out := make([]string, len(ms))
	for i, m := range ms {
		out[i] = m.ID
	}
	sort.Strings(out)
	return out
}

func TestRedisStoreIndexNearUnindex(t *testing.T) {
	ctx := context.Background()
	s := NewRedisStore(testRedis(t), Res8)
	origin := LatLon{26.8467, 75.8160}

	// "next-door" sits ~1 km away: a different Res8 cell, inside a k=2 ring.
	machines := []Machine{
		{ID: "here", Location: origin, HP: 45, Rep: 0.9},
		{ID: "next-door", Location: LatLon{26.8557, 75.8160}, HP: 55, Rep: 0.5},
		{ID: "far", Location: LatLon{27.5, 76.5}, HP: 45, Rep: 1},
	}
	for _, m := range machines {
		if err := s.Index(ctx, m); err != nil {
			t.Fatalf("index %s: %v", m.ID, err)
		}
	}

	got, err := s.Near(ctx, origin, 2)
	if err != nil {
		t.Fatalf("near: %v", err)
	}
	if want := []string{"here", "next-door"}; !equal(ids(got), want) {
		t.Fatalf("near k=2: got %v want %v", ids(got), want)
	}
	for _, m := range got {
		if m.ID == "next-door" && (m.HP != 55 || m.Rep != 0.5 || m.Location != machines[1].Location) {
			t.Fatalf("attributes not round-tripped: %+v", m)
		}
	}

	if err := s.Unindex(ctx, "next-door", machines[1].Location); err != nil {
		t.Fatalf("unindex: %v", err)
	}
	got, _ = s.Near(ctx, origin, 2)
	if want := []string{"here"}; !equal(ids(got), want) {
		t.Fatalf("after unindex: got %v want %v", ids(got), want)
	}
}

func TestRedisStoreIndexWritesOneKey(t *testing.T) {
	ctx := context.Background()
	rdb := testRedis(t)
	s := NewRedisStore(rdb, Res8)
	if err := s.Index(ctx, Machine{ID: "m", Location: LatLon{26.8, 75.8}}); err != nil {
		t.Fatal(err)
	}
	if n := rdb.DBSize(ctx).Val(); n != 1 {
		t.Fatalf("index wrote %d keys, want exactly 1 (the machine's own cell)", n)
	}
}

func equal(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
