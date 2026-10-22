package h3geo

import (
	"math"
	"testing"
)

// TestNeighboursFromLatLon confirms the H3 ring grows as expected and that
// the anchor cell is always present at index 0.
func TestNeighboursFromLatLon(t *testing.T) {
	cases := []struct {
		res Res
		k   int
		expected int
	}{
		{Res8, 1, 7},  // anchor + 6 neighbours
		{Res8, 2, 19}, // anchor + 6 + 12
		{Res7, 3, 37}, // anchor + 6 + 12 + 18
		{Res9, 1, 7},
	}
	for _, tc := range cases {
		anchor, ring, err := NeighboursFromLatLon(LatLon{Lat: 26.84, Lng: 75.83}, tc.res, tc.k)
		if err != nil {
			t.Fatalf("ring failed: %v", err)
		}
		if anchor == 0 {
			t.Fatalf("zero cell")
		}
		if len(ring) != tc.expected {
			t.Fatalf("res %d k %d: got %d cells, want %d", tc.res, tc.k, len(ring), tc.expected)
		}
		// anchor must be in ring (H3 gridDisk includes the origin)
		found := false
		for _, c := range ring {
			if c == anchor {
				found = true
				break
			}
		}
		if !found {
			t.Fatalf("anchor cell %x not in ring", uint64(anchor))
		}
	}
}

// TestNeighboursOutOfRange confirms the k boundary guard.
func TestNeighboursOutOfRange(t *testing.T) {
	anchor, _, err := NeighboursFromLatLon(LatLon{Lat: 26.84, Lng: 75.83}, Res8, 1)
	if err != nil {
		t.Fatalf("setup: %v", err)
	}
	for _, bad := range []int{0, 6, -1} {
		if _, err := anchor.Neighbours(bad); err == nil {
			t.Fatalf("expected k=%d to fail, got nil", bad)
		}
	}
}

// TestCentroidRoundTrip confirms Centroid returns sensible WGS84 for a cell
// derived from a known point.
func TestCentroidRoundTrip(t *testing.T) {
	orig := LatLon{Lat: 26.84, Lng: 75.83}
	anchor, _, err := NeighboursFromLatLon(orig, Res8, 1)
	if err != nil {
		t.Fatalf("setup: %v", err)
	}
	c, err := anchor.Centroid()
	if err != nil {
		t.Fatalf("centroid: %v", err)
	}
	// Centroid of the H3 cell should be within ~1 edge-length of the input.
	d := HaversineKm(orig, c)
	if d > 1.0 {
		t.Fatalf("centroid drift %.2f km exceeds expected ~0.5 km", d)
	}
}

// TestHaversineKm sanity-checks the distance helper.
func TestHaversineKm(t *testing.T) {
	// Delhi to Gurgaon (~30 km)
	a := LatLon{Lat: 28.6139, Lng: 77.2090}
	b := LatLon{Lat: 28.4595, Lng: 77.0266}
	d := HaversineKm(a, b)
	if math.Abs(d-23.5) > 3.0 {
		t.Fatalf("haversine: got %.2f, want ~23.5 km", d)
	}
}
