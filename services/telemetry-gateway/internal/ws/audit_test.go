package ws

// Phase 1 invariant audit (docs/audit/phase1-invariant-audit.md).
// TestAudit_* tests are RED by design.

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"

	"github.com/khetirental/telemetry-gateway/internal/geo"
)

// Many devices replay and reorder the same 1 Hz position frames for one
// machine. The track contains a 15 s spoofed jump ~600 m out and back
// (inside T_grace = 60 s: must NOT breach) and a 90 s excursion during a 2G
// blackout (beyond T_grace: MUST breach). The server must converge and keep
// enough of the track to decide D-01 for both.
func TestAudit_Concurrency_TelemetryReplaySpoofedTrack(t *testing.T) {
	const n, inLat, outLat, lng = 200, 26.8467, 26.8521, 75.8160
	parcel := geo.Parcel{CentroidLat: inLat, CentroidLng: lng} // 500 m default
	pos := func(ts int) string {
		if (ts >= 50 && ts < 65) || (ts >= 100 && ts < 190) {
			return fmt.Sprintf("%.4f,%.4f", outLat, lng)
		}
		return fmt.Sprintf("%.4f,%.4f", inLat, lng)
	}
	frame := func(ts int) string {
		return fmt.Sprintf(`{"op":"merge","node":"tractor-9","elements":{"position":{"key":"position","value":%q,"added":{"lamport":%d,"node":"tractor-9"},"removed":{"lamport":0,"node":""}}}}`, pos(ts), ts)
	}

	srv := httptest.NewServer(NewHub())
	defer srv.Close()
	const devices = 10
	var wg sync.WaitGroup
	for d := 0; d < devices; d++ {
		c := dial(t, srv, "M-9")
		order := rand.New(rand.NewSource(int64(d))).Perm(n)
		wg.Add(1)
		go func() {
			defer wg.Done()
			for _, i := range order {
				for rep := 0; rep < 2; rep++ { // duplicate delivery
					if err := c.WriteMessage(1, []byte(frame(i+1))); err != nil {
						t.Error(err)
						return
					}
					var ack map[string]any
					if err := c.ReadJSON(&ack); err != nil {
						t.Error(err)
						return
					}
				}
			}
		}()
	}
	wg.Wait()

	snap := roundTrip(t, dial(t, srv, "M-9"), `{"op":"snapshot_request"}`)
	raw, _ := json.Marshal(snap["elements"])
	var els map[string]struct{ Value string }
	_ = json.Unmarshal(raw, &els)
	if els["position"].Value != pos(n) {
		t.Fatalf("no convergence: position=%q want %q", els["position"].Value, pos(n))
	}

	outside := 0
	for _, e := range els {
		ll := strings.Split(e.Value, ",")
		if len(ll) != 2 {
			continue
		}
		lat, _ := strconv.ParseFloat(ll[0], 64)
		lon, _ := strconv.ParseFloat(ll[1], 64)
		if geo.Breach(parcel, geo.MachinePoint{Lat: lat, Lng: lon}) {
			outside++
		}
	}
	if outside < 60 {
		t.Fatalf("server kept %d sample(s) outside the parcel after convergence; a 90 s excursion (> 60 s T_grace) is invisible to D-01 and the 15 s spoof cannot be told apart from it", outside)
	}
}
