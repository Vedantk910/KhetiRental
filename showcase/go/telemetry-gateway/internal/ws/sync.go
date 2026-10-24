// Package ws implements the WebSocket transport for the offline-first
// telemetry CRDT. The protocol is deliberately minimal and stateless so
// that a 2G/3G device can re-sync from scratch after a dropped session
// without a dedicated daemon.
//
// Message shapes (JSON):
//
//	client → server:
//	  { "op":"merge", "node":"<nodeID>", "elements":{ key: {value, added:{lamport,node}, removed:{...} } } }
//	  { "op":"snapshot_request" }
//
//	server → client:
//	  { "op":"ack", "lamport":<local max lamport> }
//	  { "op":"snapshot", "node":"<nodeID>", "elements":{...} }
//
// The server holds one LWWElementSet per machine (the "server set") and
// merges every client frame into it. Because Merge is commutative and
// idempotent, the server converges to the same result regardless of the
// order or number of times a client's frames are replayed after a re-
// connection — the CAJA property that makes 2G packet drops safe.
package ws

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"

	"github.com/khetirental/telemetry-gateway/internal/crdt"
)

// MergeRequest is a client → server frame carrying a CRDT merge.
type MergeRequest struct {
	Op       string                  `json:"op"` // "merge"
	Node     string                  `json:"node"`
	Elements map[string]crdt.Element `json:"elements"`
}

// SnapshotRequest is a client → server frame asking for the current set.
type SnapshotRequest struct {
	Op string `json:"op"` // "snapshot_request"
}

// Ack is a server → client frame confirming a merge.
type Ack struct {
	Op      string `json:"op"` // "ack"
	Lamport uint64 `json:"lamport"`
}

// SnapshotResponse is a server → client frame carrying the full set.
type SnapshotResponse struct {
	Op       string                  `json:"op"` // "snapshot"
	Node     string                  `json:"node"`
	Elements map[string]crdt.Element `json:"elements"`
}

// Hub owns one CRDT per machineID and the per-connection reader loop.
type Hub struct {
	mu       sync.RWMutex
	machines map[string]*crdt.LWWElementSet
	upgrader websocket.Upgrader
}

// NewHub returns an empty hub.
func NewHub() *Hub {
	return &Hub{
		machines: make(map[string]*crdt.LWWElementSet),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(*http.Request) bool { return true }, // WS from field devices; auth is at the gateway
		},
	}
}

// SetFor returns (creating if needed) the server-side CRDT for a machine.
func (h *Hub) SetFor(machineID string) *crdt.LWWElementSet {
	h.mu.Lock()
	defer h.mu.Unlock()
	s, ok := h.machines[machineID]
	if !ok {
		s = crdt.NewLWWElementSet("server-" + machineID)
		h.machines[machineID] = s
	}
	return s
}

// ServeHTTP upgrades an HTTP connection to a WebSocket and runs the reader
// loop for a single machine (machineID is passed as a query param, e.g.
// /ws?machine=M-0042).
func (h *Hub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	machineID := r.URL.Query().Get("machine")
	if machineID == "" {
		http.Error(w, "missing ?machine=", http.StatusBadRequest)
		return
	}
	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()
	set := h.SetFor(machineID)

	for {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			// 2G/3G drop → clean close; the client reconnects and resyncs.
			return
		}
		var frame MergeRequest // snapshot_request only carries "op", which MergeRequest also decodes
		if err := json.Unmarshal(raw, &frame); err != nil {
			_ = conn.WriteJSON(map[string]string{"op": "error", "msg": "bad frame: " + err.Error()})
			continue
		}
		switch frame.Op {
		case "merge":
			set.Merge(withSamples(frame.Elements))
			ack := Ack{Op: "ack", Lamport: currentLamport(set)}
			_ = conn.WriteJSON(ack)
		case "snapshot_request":
			resp := SnapshotResponse{Op: "snapshot", Node: set.NodeID(), Elements: set.Snapshot()}
			_ = conn.WriteJSON(resp)
		default:
			_ = conn.WriteJSON(map[string]string{"op": "error", "msg": "unknown op"})
		}
	}
}

// withSamples adds a copy of each element under "<key>@<lamport>", so the
// track survives LWW convergence and D-01 can be judged over time
// (geo.BreachWindow) instead of on the last-known value only.
// shortcut: samples live in memory per machine; persist them to
// telemetry_points and trim here once the TimescaleDB writer exists.
func withSamples(els map[string]crdt.Element) map[string]crdt.Element {
	out := make(map[string]crdt.Element, 2*len(els))
	for k, el := range els {
		out[k] = el
		if el.Added.Lamport > 0 {
			sk := fmt.Sprintf("%s@%d", k, el.Added.Lamport)
			el.Key = sk
			out[sk] = el
		}
	}
	return out
}

// currentLamport returns the maximum Lamport clock observed so far.
func currentLamport(s *crdt.LWWElementSet) uint64 {
	var max uint64
	for _, el := range s.Snapshot() {
		if el.Added.Lamport > max {
			max = el.Added.Lamport
		}
		if el.Removed.Lamport > max {
			max = el.Removed.Lamport
		}
	}
	return max
}
