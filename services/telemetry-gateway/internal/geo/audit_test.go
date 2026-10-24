package geo

// Phase 1 invariant audit (docs/audit/phase1-invariant-audit.md).
// TestAudit_* tests are RED by design: each fails against today's code and
// passes once the corresponding remediation lands.

import "testing"

// D-01: "> 500 m outside registered parcel". anomaly.go:41-45 uses the
// parcel radius itself as the breach distance, so with an explicit radius a
// machine 1 m past the edge is a breach.
func TestAudit_D01_BreachMeasuredFromParcelEdge(t *testing.T) {
	p := Parcel{CentroidLat: 26.8467, CentroidLng: 75.8160, RadiusM: 300}
	// ~556 m from centroid = ~256 m outside a 300 m parcel: inside the 500 m allowance.
	if Breach(p, MachinePoint{Lat: 26.8517, Lng: 75.8160}) {
		t.Fatal("machine ~256 m outside a 300 m parcel flagged as D-01 breach (rule is > 500 m outside the parcel)")
	}
	// ~900 m from centroid = ~600 m outside: a breach.
	if !Breach(p, MachinePoint{Lat: 26.8548, Lng: 75.8160}) {
		t.Fatal("machine ~600 m outside the parcel not flagged")
	}
}

// D-02: exactly 10 % divergence is not tamper (rule is "> 10 %"), whatever
// the magnitude. anomaly.go:58 divides floats, so 1.1 vs 1.0 yields 0.10000000000000009.
func TestAudit_D02_ExactTenPercentBoundary(t *testing.T) {
	for _, c := range []struct{ ecu, gps float64 }{{1.1, 1.0}, {2.2, 2.0}, {110, 100}} {
		if Tamper(MachinePoint{ECUHours: c.ecu, GPSTravelH: c.gps}) {
			t.Errorf("ECU %.1f h vs GPS %.1f h is exactly 10 %% but flagged as tamper", c.ecu, c.gps)
		}
	}
}
