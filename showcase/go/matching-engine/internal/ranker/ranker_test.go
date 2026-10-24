package ranker

import (
	"testing"

	"github.com/khetirental/matching-engine/internal/h3geo"
)

// TestDefaultWeightsSum confirms the shipped weights sum to 1.
func TestDefaultWeightsSum(t *testing.T) {
	if _, err := New(DefaultWeights, 45); err != nil {
		t.Fatalf("default weights should be valid: %v", err)
	}
}

// TestInvalidWeights confirms a non-summable weight set is rejected.
func TestInvalidWeights(t *testing.T) {
	if _, err := New(Weights{Distance: 0.9, HP: 0.5, Reputation: 0.1}, 45); err == nil {
		t.Fatal("expected error for weights summing to 1.5")
	}
}

// TestRankPrefersCloserAndHigherRep confirms the multi-criteria function
// orders candidates sensibly.
func TestRankPrefersCloserAndHigherRep(t *testing.T) {
	req := h3geo.LatLon{Lat: 26.84, Lng: 75.83}
	rk, err := New(DefaultWeights, 45)
	if err != nil {
		t.Fatal(err)
	}
	cands := []Candidate{
		{ID: "far-low", Location: h3geo.LatLon{Lat: 26.84 + 0.10, Lng: 75.83}, HorsePower: 55, OwnerReputation: 0.2},
		{ID: "near-high", Location: h3geo.LatLon{Lat: 26.84 + 0.005, Lng: 75.83}, HorsePower: 45, OwnerReputation: 0.9},
		{ID: "mid-mid", Location: h3geo.LatLon{Lat: 26.84 + 0.05, Lng: 75.83}, HorsePower: 45, OwnerReputation: 0.5},
	}
	out := rk.Rank(cands, req)
	if len(out) != 3 {
		t.Fatalf("got %d scored candidates", len(out))
	}
	if out[0].ID != "near-high" {
		t.Fatalf("expected near-high to rank first, got %s", out[0].ID)
	}
	if out[2].ID != "far-low" {
		t.Fatalf("expected far-low to rank last, got %s", out[2].ID)
	}
}

// TestHPTieBreak confirms a closer machine wins when HP and reputation match.
func TestHPTieBreak(t *testing.T) {
	req := h3geo.LatLon{Lat: 26.84, Lng: 75.83}
	rk, _ := New(Weights{Distance: 0.6, HP: 0.3, Reputation: 0.1}, 45)
	cands := []Candidate{
		{ID: "a", Location: h3geo.LatLon{Lat: 26.84, Lng: 75.83 + 0.001}, HorsePower: 45, OwnerReputation: 0.5},
		{ID: "b", Location: h3geo.LatLon{Lat: 26.84, Lng: 75.83 + 0.01}, HorsePower: 45, OwnerReputation: 0.5},
	}
	out := rk.Rank(cands, req)
	if out[0].ID != "a" {
		t.Fatalf("closer machine should win tie: got %s", out[0].ID)
	}
}
