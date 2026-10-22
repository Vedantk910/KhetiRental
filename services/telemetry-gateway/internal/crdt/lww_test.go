package crdt

import (
	"testing"
)

// TestConvergentTwoNodes confirms two nodes that exchange snapshots in
// different orders converge to the same set — the CAJA property.
func TestConvergentTwoNodes(t *testing.T) {
	a := NewLWWElementSet("nodeA")
	b := NewLWWElementSet("nodeB")

	a.Add("engine_hours", "120.5")
	b.Add("engine_hours", "120.5")

	_ = a.Merge(b.Snapshot())
	_ = b.Merge(a.Snapshot())

	va, _ := a.ValueAt("engine_hours")
	vb, _ := b.ValueAt("engine_hours")
	if va != vb {
		t.Fatalf("divergence: nodeA=%q nodeB=%q", va, vb)
	}
}

// TestLateFrameDoesNotClobber confirms a late-arriving older clock loses
// to a newer local write — the LWW property that protects 2G reorders.
func TestLateFrameDoesNotClobber(t *testing.T) {
	local := NewLWWElementSet("local")
	local.Add("gps_lat", "26.84")
	local.Add("gps_lng", "75.83")
	local.Add("gps_lat", "26.85")

	remote := map[string]Element{
		"gps_lat": {Key: "gps_lat", Value: "26.80", Added: Clock{Lamport: 1, NodeID: "remote"}, Removed: Clock{}},
	}
	local.Merge(remote)

	got, _ := local.ValueAt("gps_lat")
	if got != "26.85" {
		t.Fatalf("stale frame clobbered newer value: got %q want 26.85", got)
	}
}

// TestRemoveThenReAdd confirms the added/removed clock interplay.
func TestRemoveThenReAdd(t *testing.T) {
	s := NewLWWElementSet("n")
	s.Add("fuel_level", "80")
	if !s.Contains("fuel_level") {
		t.Fatal("expected present after add")
	}
	s.Remove("fuel_level")
	if s.Contains("fuel_level") {
		t.Fatal("expected absent after remove")
	}
	s.Add("fuel_level", "75")
	if !s.Contains("fuel_level") {
		t.Fatal("expected present after re-add")
	}
}

// TestIdempotentMerge confirms merging the same snapshot twice is a no-op
// on the second pass.
func TestIdempotentMerge(t *testing.T) {
	s := NewLWWElementSet("n")
	s.Add("k", "v")
	snap := s.Snapshot()
	s.Merge(snap)
	s.Merge(snap)
	v, ok := s.ValueAt("k")
	if !ok || v != "v" {
		t.Fatalf("idempotent merge broke value: got %q ok=%v", v, ok)
	}
}
