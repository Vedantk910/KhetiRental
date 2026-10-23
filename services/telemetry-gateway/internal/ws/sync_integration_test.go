package ws

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gorilla/websocket"
)

func dial(t *testing.T, srv *httptest.Server, machine string) *websocket.Conn {
	t.Helper()
	url := "ws" + strings.TrimPrefix(srv.URL, "http") + "/?machine=" + machine
	c, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	t.Cleanup(func() { c.Close() })
	return c
}

func roundTrip(t *testing.T, c *websocket.Conn, frame string) map[string]any {
	t.Helper()
	if err := c.WriteMessage(websocket.TextMessage, []byte(frame)); err != nil {
		t.Fatal(err)
	}
	var out map[string]any
	if err := c.ReadJSON(&out); err != nil {
		t.Fatal(err)
	}
	return out
}

// TestMergeAckSnapshotAndReconnect drives the documented wire protocol end to
// end: merge → ack, a 2G drop, replay of the same frame, then a snapshot from
// a fresh connection.
func TestMergeAckSnapshotAndReconnect(t *testing.T) {
	srv := httptest.NewServer(NewHub())
	defer srv.Close()

	merge := `{"op":"merge","node":"tractor-1","elements":{"engine_hours":
		{"key":"engine_hours","value":"120.5","added":{"lamport":7,"node":"tractor-1"},"removed":{"lamport":0,"node":""}}}}`

	c := dial(t, srv, "M-1")
	ack := roundTrip(t, c, merge)
	if ack["op"] != "ack" || ack["lamport"] != float64(7) {
		t.Fatalf("ack = %v, want op=ack lamport=7", ack)
	}
	c.Close() // simulated 2G drop

	c2 := dial(t, srv, "M-1")
	if ack := roundTrip(t, c2, merge); ack["lamport"] != float64(7) {
		t.Fatalf("replayed merge not idempotent: %v", ack)
	}
	snap := roundTrip(t, c2, `{"op":"snapshot_request"}`)
	el, _ := snap["elements"].(map[string]any)["engine_hours"].(map[string]any)
	if snap["op"] != "snapshot" || el["value"] != "120.5" {
		t.Fatalf("snapshot = %v", snap)
	}
	added, _ := el["added"].(map[string]any)
	if added["node"] != "tractor-1" {
		t.Fatalf("clock node id lost on the wire: %v", el)
	}
}

func TestMachinesAreIsolated(t *testing.T) {
	srv := httptest.NewServer(NewHub())
	defer srv.Close()
	roundTrip(t, dial(t, srv, "A"), `{"op":"merge","node":"n","elements":{"k":{"key":"k","value":"v","added":{"lamport":1,"node":"n"}}}}`)
	snap := roundTrip(t, dial(t, srv, "B"), `{"op":"snapshot_request"}`)
	if els, _ := snap["elements"].(map[string]any); len(els) != 0 {
		t.Fatalf("machine B sees machine A's data: %v", snap)
	}
}

func TestProtocolErrors(t *testing.T) {
	srv := httptest.NewServer(NewHub())
	defer srv.Close()

	if res, _ := http.Get(srv.URL + "/"); res.StatusCode != http.StatusBadRequest {
		t.Fatalf("missing ?machine=: status %d want 400", res.StatusCode)
	}
	c := dial(t, srv, "M-1")
	if out := roundTrip(t, c, `not json`); out["op"] != "error" {
		t.Fatalf("bad frame: %v", out)
	}
	if out := roundTrip(t, c, `{"op":"explode"}`); out["op"] != "error" || out["msg"] != "unknown op" {
		t.Fatalf("unknown op: %v", out)
	}
}
