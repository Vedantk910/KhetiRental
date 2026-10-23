// Command match-service exposes the KhetiRental H3 matching engine.
//
// Build:   cd services/matching-engine && go build -o /tmp/match-service ./cmd/match-service
// Run:     REDIS_ADDR=127.0.0.1:6379 LISTEN=:8080 H3_RES=8 /tmp/match-service
//
// The H3 resolution is configurable via H3_RES (default 8, ~460 m edge).
// The K-ring k defaults to 2 (≈ 0.9 km radius at Res8) unless the request
// overrides it via ?k=.
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/khetirental/matching-engine/internal/h3geo"
	storehandler "github.com/khetirental/matching-engine/internal/store"
)

func main() {
	redisAddr := env("REDIS_ADDR", "127.0.0.1:6379")
	listen := env("LISTEN", ":8080")
	resStr := env("H3_RES", "8")

	res, err := strconv.Atoi(resStr)
	if err != nil || (res != 7 && res != 8 && res != 9) {
		log.Fatalf("H3_RES must be 7, 8, or 9; got %q", resStr)
	}
	hres := h3geo.Res(res)

	rdb := redis.NewClient(&redis.Options{Addr: redisAddr})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Printf("WARN: redis ping failed (%v); continuing (may be offline)", err)
	}

	hstore := h3geo.NewRedisStore(rdb, hres)
	h := storehandler.New(hstore, hres)

	log.Printf("listening on %s (h3 resolution %d, default ring k=2)", listen, hres)
	srv := &http.Server{Addr: listen, Handler: h.Mux()}
	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("http server: %v", err)
	}
}

// env reads an environment variable with a fallback.
func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
