// Package ranker scores H3 candidates against a multi-criteria function:
//
//	score = w_d * distanceScore + w_hp * hpMatch + w_rep * ownerReputation
//
// - distanceScore: exponential decay over Haversine distance (km), τ=2.0 km
// - hpMatch:        1/(1+exp(|requestedHP-actualHP|/3))
// - ownerReputation: normalized 0..1 from a reputation score
package ranker

import (
	"fmt"
	"math"
	"sort"

	"github.com/khetirental/matching-engine/internal/h3geo"
)

// Weights must sum to 1.0 (validated in New).
type Weights struct {
	Distance   float64
	HP         float64
	Reputation float64
}

// DefaultWeights is the production default: distance dominates, HP matters,
// reputation is a tie-breaker.
var DefaultWeights = Weights{Distance: 0.5, HP: 0.3, Reputation: 0.2}

// Candidate is a machine in the k-ring.
type Candidate struct {
	ID              string
	Location        h3geo.LatLon
	HorsePower      float64
	OwnerReputation float64 // 0..1
}

// Scored is a candidate plus its ranker output.
type Scored struct {
	Candidate
	Score  float64
	DistKm float64
}

// Ranker scores and sorts candidates by score desc.
type Ranker struct {
	w     Weights
	τ     float64 // distance decay constant (km)
	ReqHP float64
}

// New validates the weights and returns a Ranker for the requested HP.
func New(w Weights, requestedHP float64) (*Ranker, error) {
	sum := w.Distance + w.HP + w.Reputation
	if math.Abs(sum-1.0) > 1e-9 {
		return nil, fmt.Errorf("ranker: weights must sum to 1.0, got %v", sum)
	}
	return &Ranker{w: w, τ: 2.0, ReqHP: requestedHP}, nil
}

// Rank scores every candidate and returns them sorted by score desc.
// Ties are broken by distance asc (closer wins).
func (r *Ranker) Rank(cands []Candidate, req h3geo.LatLon) []Scored {
	out := make([]Scored, 0, len(cands))
	for _, c := range cands {
		d := h3geo.HaversineKm(req, c.Location)
		distScore := math.Exp(-d / r.τ)
		hpGap := math.Abs(r.ReqHP - c.HorsePower)
		hpScore := 1.0 / (1.0 + math.Exp(hpGap/3.0))
		combined := r.w.Distance*distScore + r.w.HP*hpScore + r.w.Reputation*c.OwnerReputation
		out = append(out, Scored{Candidate: c, Score: combined, DistKm: d})
	}
	sort.SliceStable(out, func(i, j int) bool {
		if math.Abs(out[i].Score-out[j].Score) > 1e-12 {
			return out[i].Score > out[j].Score
		}
		return out[i].DistKm < out[j].DistKm
	})
	return out
}
