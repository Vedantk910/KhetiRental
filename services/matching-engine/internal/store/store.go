// Package store is the HTTP handler for the matching engine.
//
// Endpoints:
//
//	GET /machines/near?lat=&lng=&radius_km=&hp=&k=&limit=
//	    → JSON: { candidates: [ { id, dist_km, score, hp, reputation } ] }
//
//	POST /machines/index
//	    body: { id, lat, lng, hp, reputation }
//	    → 204 on success
//
//	DELETE /machines/unindex
//	    body: { id, lat, lng }
//	    → 204 on success
package store

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/khetirental/matching-engine/internal/h3geo"
	"github.com/khetirental/matching-engine/internal/ranker"
)

// Handler wires up H3 + ranker behind an HTTP surface.
type Handler struct {
	store *h3geo.RedisStore
	res   h3geo.Res
}

// New returns an HTTP handler backed by the given H3 resolution.
func New(store *h3geo.RedisStore, res h3geo.Res) *Handler {
	return &Handler{store: store, res: res}
}

// Mux returns the HTTP routes.
func (h *Handler) Mux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /machines/near", h.handleNear)
	mux.HandleFunc("POST /machines/index", h.handleIndex)
	mux.HandleFunc("DELETE /machines/unindex", h.handleUnindex)
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		fmt.Fprint(w, "ok")
	})
	return mux
}

// --- request / response shapes --------------------------------------------

type MachineRecord struct {
	ID  string  `json:"id"`
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
	HP  float64 `json:"hp"`
	Rep float64 `json:"reputation"` // 0..1
}

type NearResp struct {
	Candidates []CandidateJSON `json:"candidates"`
	TookMs     float64         `json:"took_ms"`
}

type CandidateJSON struct {
	ID         string  `json:"id"`
	DistKm     float64 `json:"dist_km"`
	Score      float64 `json:"score"`
	Hp         float64 `json:"hp"`
	Reputation float64 `json:"reputation"`
}

func (h *Handler) handleNear(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	lat, err := strconv.ParseFloat(q.Get("lat"), 64)
	if err != nil {
		httpError(w, 400, "lat is required and must be a number")
		return
	}
	lng, err := strconv.ParseFloat(q.Get("lng"), 64)
	if err != nil {
		httpError(w, 400, "lng is required and must be a number")
		return
	}
	radius := 5.0
	if s := q.Get("radius_km"); s != "" {
		if f, err := strconv.ParseFloat(s, 64); err == nil && f > 0 {
			radius = f
		}
	}
	reqHP := 45.0
	if s := q.Get("hp"); s != "" {
		if f, err := strconv.ParseFloat(s, 64); err == nil {
			reqHP = f
		}
	}
	limit := 20
	if s := q.Get("limit"); s != "" {
		if n, err := strconv.Atoi(s); err == nil && n >= 1 && n <= 100 {
			limit = n
		}
	}
	k := 2
	if s := q.Get("k"); s != "" {
		if f, err := strconv.Atoi(s); err == nil && f >= 1 && f <= 5 {
			k = f
		}
	}

	// Convert requested radius_km to H3 k-ring.
	// H3 ring area ~ π*(edge*k)^2.  Edge(res8)≈460 m, so k≈radiusKm/0.46.
	edgeKm := edgeLengthKm(h.res)
	kByRadius := int(radius/edgeKm) + 1
	if kByRadius < 1 {
		kByRadius = 1
	}
	if kByRadius > 5 {
		kByRadius = 5
	}
	useK := intMin(k, kByRadius)

	start := time.Now()
	origin := h3geo.LatLon{Lat: lat, Lng: lng}
	machines, err := h.store.Near(r.Context(), origin, useK)
	if err != nil {
		httpError(w, 500, "h3 lookup failed: "+err.Error())
		return
	}

	cands := make([]ranker.Candidate, 0, len(machines))
	for _, m := range machines {
		// The k-ring is a hexagonal superset of the radius; trim its corners.
		if h3geo.HaversineKm(origin, m.Location) > radius {
			continue
		}
		cands = append(cands, ranker.Candidate{ID: m.ID, Location: m.Location, HorsePower: m.HP, OwnerReputation: m.Rep})
	}

	rk, err := ranker.New(ranker.DefaultWeights, reqHP)
	if err != nil {
		httpError(w, 500, "ranker init failed: "+err.Error())
		return
	}
	scores := rk.Rank(cands, origin)
	if len(scores) > limit {
		scores = scores[:limit] // Rank sorts by score desc
	}

	out := NearResp{
		TookMs: float64(time.Since(start).Nanoseconds()) / 1e6,
	}
	for _, s := range scores {
		out.Candidates = append(out.Candidates, CandidateJSON{
			ID: s.ID, DistKm: s.DistKm, Score: s.Score, Hp: s.HorsePower, Reputation: s.OwnerReputation,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(out)
}

func (h *Handler) handleIndex(w http.ResponseWriter, r *http.Request) {
	var rec MachineRecord
	if err := json.NewDecoder(r.Body).Decode(&rec); err != nil || rec.ID == "" {
		httpError(w, 400, "body must be JSON with id, lat, lng")
		return
	}
	if err := h.store.Index(r.Context(), h3geo.Machine{ID: rec.ID, Location: h3geo.LatLon{Lat: rec.Lat, Lng: rec.Lng}, HP: rec.HP, Rep: rec.Rep}); err != nil {
		httpError(w, 500, "index failed: "+err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) handleUnindex(w http.ResponseWriter, r *http.Request) {
	var rec MachineRecord
	if err := json.NewDecoder(r.Body).Decode(&rec); err != nil || rec.ID == "" {
		httpError(w, 400, "body must be JSON with id, lat, lng")
		return
	}
	if err := h.store.Unindex(r.Context(), rec.ID, h3geo.LatLon{Lat: rec.Lat, Lng: rec.Lng}); err != nil {
		httpError(w, 500, "unindex failed: "+err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- helpers ---------------------------------------------------------------

func httpError(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

// edgeLengthKm approximates the H3 edge length for our 3 tiers
// (values from skills/go-systems-architect/SKILL.md).
func edgeLengthKm(res h3geo.Res) float64 {
	switch res {
	case h3geo.Res7:
		return 1.2
	case h3geo.Res8:
		return 0.46
	case h3geo.Res9:
		return 0.174
	default:
		return 0.46
	}
}

func intMin(a, b int) int {
	if a < b {
		return a
	}
	return b
}
