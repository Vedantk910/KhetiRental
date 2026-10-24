package store

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/redis/go-redis/v9"

	"github.com/khetirental/matching-engine/internal/h3geo"
)

// newServer wires the real handler to a scratch Redis DB. Skips when Redis is
// unreachable (REDIS_TEST_ADDR, default 127.0.0.1:6390).
const testToken = "test-service-token"

func newServer(t *testing.T) *httptest.Server { return newServerWithToken(t, testToken) }

func newServerWithToken(t *testing.T, token string) *httptest.Server {
	t.Helper()
	addr := os.Getenv("REDIS_TEST_ADDR")
	if addr == "" {
		addr = "127.0.0.1:6390"
	}
	rdb := redis.NewClient(&redis.Options{Addr: addr, DB: 10})
	ctx := context.Background()
	if err := rdb.Ping(ctx).Err(); err != nil {
		t.Skipf("integration: redis %s unreachable: %v", addr, err)
	}
	rdb.FlushDB(ctx)
	srv := httptest.NewServer(New(h3geo.NewRedisStore(rdb, h3geo.Res8), h3geo.Res8, token).Mux())
	t.Cleanup(func() { srv.Close(); rdb.FlushDB(ctx); rdb.Close() })
	return srv
}

// do calls the API as the trusted indexing service (with the service token).
func do(t *testing.T, method, url, body string) *http.Response {
	t.Helper()
	return doAs(t, method, url, body, "Bearer "+testToken)
}

func doAs(t *testing.T, method, url, body, auth string) *http.Response {
	t.Helper()
	req, _ := http.NewRequest(method, url, strings.NewReader(body))
	if auth != "" {
		req.Header.Set("Authorization", auth)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	return res
}

func near(t *testing.T, srv *httptest.Server, query string) NearResp {
	t.Helper()
	res := do(t, "GET", srv.URL+"/machines/near?"+query, "")
	defer res.Body.Close()
	if res.StatusCode != 200 {
		t.Fatalf("near %s: status %d", query, res.StatusCode)
	}
	var out NearResp
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	return out
}

func TestNearRanksRealAttributesAndTrimsRadius(t *testing.T) {
	srv := newServer(t)
	for _, m := range []string{
		`{"id":"best","lat":26.8467,"lng":75.8160,"hp":45,"reputation":0.95}`,
		`{"id":"wrong-hp","lat":26.8470,"lng":75.8165,"hp":75,"reputation":0.95}`,
		`{"id":"far","lat":26.8467,"lng":75.8700,"hp":45,"reputation":1}`, // ~5.4 km east
	} {
		if res := do(t, "POST", srv.URL+"/machines/index", m); res.StatusCode != 204 {
			t.Fatalf("index %s: %d", m, res.StatusCode)
		}
	}

	out := near(t, srv, "lat=26.8467&lng=75.8160&radius_km=2&hp=45&k=5")
	if len(out.Candidates) != 2 {
		t.Fatalf("radius 2 km: got %d candidates %+v, want 2 (far trimmed)", len(out.Candidates), out.Candidates)
	}
	top := out.Candidates[0]
	if top.ID != "best" || top.Hp != 45 || top.Reputation != 0.95 {
		t.Fatalf("top candidate = %+v, want best with hp/rep hydrated", top)
	}
	if out.Candidates[1].DistKm <= 0 {
		t.Fatalf("distance not computed from real location: %+v", out.Candidates[1])
	}
}

func TestNearLimit(t *testing.T) {
	srv := newServer(t)
	for i := 0; i < 30; i++ {
		body := fmt.Sprintf(`{"id":"m%d","lat":26.8467,"lng":%f,"hp":45,"reputation":0.5}`, i, 75.8160+float64(i)*0.0001)
		do(t, "POST", srv.URL+"/machines/index", body)
	}
	if n := len(near(t, srv, "lat=26.8467&lng=75.8160").Candidates); n != 20 {
		t.Fatalf("default limit: got %d want 20", n)
	}
	if n := len(near(t, srv, "lat=26.8467&lng=75.8160&limit=5").Candidates); n != 5 {
		t.Fatalf("limit=5: got %d", n)
	}
}

func TestUnindexAndValidation(t *testing.T) {
	srv := newServer(t)
	do(t, "POST", srv.URL+"/machines/index", `{"id":"m","lat":26.8467,"lng":75.8160}`)
	if res := do(t, "DELETE", srv.URL+"/machines/unindex", `{"id":"m","lat":26.8467,"lng":75.8160}`); res.StatusCode != 204 {
		t.Fatalf("unindex status %d", res.StatusCode)
	}
	if n := len(near(t, srv, "lat=26.8467&lng=75.8160").Candidates); n != 0 {
		t.Fatalf("after unindex: %d candidates", n)
	}
	for _, c := range []struct{ method, path, body string }{
		{"GET", "/machines/near?lng=75.8", ""},
		{"POST", "/machines/index", `{"lat":1,"lng":2}`},
		{"POST", "/machines/index", `not json`},
	} {
		if res := do(t, c.method, srv.URL+c.path, c.body); res.StatusCode != 400 {
			t.Fatalf("%s %s %q: status %d want 400", c.method, c.path, c.body, res.StatusCode)
		}
	}
}
