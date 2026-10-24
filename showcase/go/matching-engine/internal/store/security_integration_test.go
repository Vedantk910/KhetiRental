package store

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"sync"
	"testing"
)

// S-01: writes need the service token; with none configured they're refused.
func TestWriteEndpointsRequireServiceToken(t *testing.T) {
	srv := newServer(t)
	body := `{"id":"m","lat":26.8467,"lng":75.8160,"hp":45,"reputation":0.5}`
	for _, auth := range []string{"", "Bearer wrong", "Bearer " + testToken + "x", testToken} {
		if res := doAs(t, "POST", srv.URL+"/machines/index", body, auth); res.StatusCode != 401 {
			t.Errorf("index with auth %q: status %d, want 401", auth, res.StatusCode)
		}
		if res := doAs(t, "DELETE", srv.URL+"/machines/unindex", body, auth); res.StatusCode != 401 {
			t.Errorf("unindex with auth %q: status %d, want 401", auth, res.StatusCode)
		}
	}
	if res := do(t, "POST", srv.URL+"/machines/index", body); res.StatusCode != 204 {
		t.Fatalf("correct token: status %d, want 204", res.StatusCode)
	}

	closed := newServerWithToken(t, "")
	if res := doAs(t, "POST", closed.URL+"/machines/index", body, "Bearer "); res.StatusCode != 401 {
		t.Fatalf("no token configured: status %d, want 401 (fail closed)", res.StatusCode)
	}
}

// S-01: the review's exploit — a fake machine with reputation 99 ranking first.
func TestIndexRejectsOutOfRangeRecords(t *testing.T) {
	srv := newServer(t)
	for _, b := range []string{
		`{"id":"x","lat":91,"lng":75,"hp":45,"reputation":0.5}`,
		`{"id":"x","lat":26,"lng":181,"hp":45,"reputation":0.5}`,
		`{"id":"x","lat":26,"lng":75,"hp":45,"reputation":99}`,
		`{"id":"x","lat":26,"lng":75,"hp":45,"reputation":-0.1}`,
		`{"id":"x","lat":26,"lng":75,"hp":5,"reputation":0.5}`,
		`{"id":"x","lat":26,"lng":75,"hp":500,"reputation":0.5}`,
		`{"id":"` + strings.Repeat("x", 200) + `","lat":26,"lng":75,"hp":45,"reputation":0.5}`,
	} {
		if res := do(t, "POST", srv.URL+"/machines/index", b); res.StatusCode != 400 {
			t.Errorf("%.60s: status %d, want 400", b, res.StatusCode)
		}
	}
}

// S-05: bad coordinates are 400, errors don't leak internals, empty is [].
func TestNearValidatesAndNeverLeaks(t *testing.T) {
	srv := newServer(t)
	for _, q := range []string{"lat=NaN&lng=75", "lat=500&lng=75", "lat=26&lng=-200", "lat=Inf&lng=75"} {
		res := do(t, "GET", srv.URL+"/machines/near?"+q, "")
		b, _ := io.ReadAll(res.Body)
		if res.StatusCode != 400 || strings.Contains(strings.ToLower(string(b)), "h3") {
			t.Errorf("%s: status %d body %s, want 400 with a generic message", q, res.StatusCode, b)
		}
	}
	res := do(t, "GET", srv.URL+"/machines/near?lat=10&lng=10", "")
	var raw map[string]json.RawMessage
	_ = json.NewDecoder(res.Body).Decode(&raw)
	if string(raw["candidates"]) != "[]" {
		t.Fatalf("empty result: candidates = %s, want []", raw["candidates"])
	}
}

// Adversarial: 50 concurrent unauthenticated writers change nothing.
func TestConcurrentUnauthenticatedWritesChangeNothing(t *testing.T) {
	srv := newServer(t)
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			b := fmt.Sprintf(`{"id":"FAKE-%d","lat":26.8467,"lng":75.8160,"hp":45,"reputation":1}`, i)
			if res := doAs(t, "POST", srv.URL+"/machines/index", b, ""); res.StatusCode != 401 {
				t.Errorf("writer %d: status %d", i, res.StatusCode)
			}
		}(i)
	}
	wg.Wait()
	if n := len(near(t, srv, "lat=26.8467&lng=75.8160&k=5").Candidates); n != 0 {
		t.Fatalf("%d fake machines got indexed", n)
	}
}
