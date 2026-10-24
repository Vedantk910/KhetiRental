// Command telemetry-gateway exposes the offline-first telemetry sync
// endpoint backed by the LWW-Element-Set CRDT. It is the "Offline Sync
// Service" container in the C4 model: a single WS endpoint that field
// devices / the mobile app reconnect to and resync from.
//
// Build:  cd showcase/go/telemetry-gateway && go build -o /tmp/telemetry ./cmd/telemetry-gateway
// Run:    LISTEN=:8081 /tmp/telemetry
// Connect:  ws://host:8081/ws?machine=M-0042
//
// The gateway also runs the anomaly detection described in
// skills/marketplace-risk-escrow (geofence breach >500 m, engine-hour
// tamper >10 %) — see internal/geo/anomaly.go.
package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/khetirental/telemetry-gateway/internal/ws"
)

func main() {
	listen := os.Getenv("LISTEN")
	if listen == "" {
		listen = ":8081"
	}
	hub := ws.NewHub()

	mux := http.NewServeMux()
	mux.Handle("/ws", hub)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("ok"))
	})

	log.Printf("telemetry-gateway listening on %s (ws at /ws?machine=ID)", listen)
	if err := newHTTPServer(listen, mux).ListenAndServe(); err != nil {
		log.Fatalf("http server: %v", err)
	}
}

// newHTTPServer bounds how long a client may hold a connection (REVIEW S-06).
func newHTTPServer(addr string, h http.Handler) *http.Server {
	return &http.Server{
		Addr:              addr,
		Handler:           h,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
}
