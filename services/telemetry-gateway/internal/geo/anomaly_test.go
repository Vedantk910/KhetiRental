package geo

import "testing"

func TestBreach(t *testing.T) {
	p := Parcel{CentroidLat: 26.8467, CentroidLng: 75.8160} // RadiusM 0 → 500 m default
	cases := []struct {
		name string
		lat  float64
		want bool
	}{
		{"at centroid", 26.8467, false},
		{"~445 m north, inside", 26.8507, false},
		{"~556 m north, outside", 26.8517, true},
	}
	for _, c := range cases {
		if got := Breach(p, MachinePoint{Lat: c.lat, Lng: 75.8160}); got != c.want {
			t.Errorf("%s: Breach=%v want %v", c.name, got, c.want)
		}
	}
	// An explicit parcel radius overrides the 500 m default.
	wide := Parcel{CentroidLat: 26.8467, CentroidLng: 75.8160, RadiusM: 1000}
	if Breach(wide, MachinePoint{Lat: 26.8517, Lng: 75.8160}) {
		t.Error("556 m inside a 1 km parcel flagged as breach")
	}
}

func TestTamper(t *testing.T) {
	cases := []struct {
		name     string
		ecu, gps float64
		want     bool
	}{
		{"exact match", 100, 100, false},
		{"10% over is the boundary, not tamper", 110, 100, false},
		{"10.5% over", 110.5, 100, true},
		{"rolled-back meter 15% under", 85, 100, true},
		{"no GPS reference", 50, 0, false},
	}
	for _, c := range cases {
		if got := Tamper(MachinePoint{ECUHours: c.ecu, GPSTravelH: c.gps}); got != c.want {
			t.Errorf("%s: Tamper=%v want %v", c.name, got, c.want)
		}
	}
}
