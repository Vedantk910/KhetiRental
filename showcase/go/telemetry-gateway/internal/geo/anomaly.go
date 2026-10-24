// Package geo implements the telematics anomaly detection rules from
// skills/marketplace-risk-escrow (Amazon INVEST standard):
//
//   - Geofence breach: machine >500 m outside registered parcel → freeze
//     the security deposit.
//   - Hour tampering: ECU CAN-bus run-hours vs GPS travel tracking
//     diverge by >10 % → flag the record.
//
// These are pure decision functions over the CRDT's last-known values, so
// they run identically on the gateway and (for offline verification) on the
// device.
package geo

import (
	"math"
	"sort"
)

// GeofenceRadiusM is how far beyond the registered parcel edge a machine may go.
const GeofenceRadiusM = 500.0

// GeofenceGraceS is D-01's T_grace: a breach must persist this long.
const GeofenceGraceS = 60

// HourTamperThreshold is the max accepted divergence between ECU hours and
// GPS-travel-implied hours.
const HourTamperThreshold = 0.10 // 10 %

// Parcel is a registered farm boundary approximated by a centroid + radius.
type Parcel struct {
	CentroidLat float64
	CentroidLng float64
	RadiusM     float64
}

// MachinePoint is one telemetry observation.
type MachinePoint struct {
	Lat        float64
	Lng        float64
	ECUHours   float64 // engine-hour meter (CAN-bus)
	GPSTravelH float64 // hours implied by GPS travel log
}

// Breach reports whether the machine is more than GeofenceRadiusM beyond the
// parcel edge (RadiusM 0 treats the parcel as its centroid).
func Breach(p Parcel, m MachinePoint) bool {
	d := haversineM(p.CentroidLat, p.CentroidLng, m.Lat, m.Lng)
	return d-math.Max(p.RadiusM, 0) > GeofenceRadiusM
}

// TimedPoint is a sample stamped with the device's clock.
type TimedPoint struct {
	UnixS int64
	MachinePoint
}

// BreachWindow evaluates D-01 over a track: true if the samples, ordered by
// device time, show the machine outside for at least GeofenceGraceS. A run is
// timed from its first outside sample to the next inside sample (or its own
// last sample), so a single drifted fix never counts.
func BreachWindow(p Parcel, track []TimedPoint) bool {
	pts := append([]TimedPoint(nil), track...)
	sort.Slice(pts, func(i, j int) bool { return pts[i].UnixS < pts[j].UnixS })
	start := int64(-1)
	for _, pt := range pts {
		switch out := Breach(p, pt.MachinePoint); {
		case out && start < 0:
			start = pt.UnixS
		case out && pt.UnixS-start >= GeofenceGraceS:
			return true
		case !out && start >= 0:
			if pt.UnixS-start >= GeofenceGraceS {
				return true
			}
			start = -1
		}
	}
	return false
}

// Tamper reports whether ECU vs GPS run-hour divergence exceeds 10 %.
func Tamper(m MachinePoint) bool {
	base := m.GPSTravelH
	if base <= 0 {
		return false // no travel reference → no tamper signal
	}
	diff := m.ECUHours - base
	if diff < 0 {
		diff = -diff
	}
	return diff/base > HourTamperThreshold+1e-9 // exactly 10 % is not tamper, despite float rounding
}

// haversineM returns great-circle distance in metres.
func haversineM(lat1, lng1, lat2, lng2 float64) float64 {
	const r = 6371000.0
	const rad = 3.141592653589793 / 180.0
	dLat := (lat2 - lat1) * rad
	dLng := (lng2 - lng1) * rad
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*rad)*math.Cos(lat2*rad)*math.Sin(dLng/2)*math.Sin(dLng/2)
	return 2 * r * math.Asin(math.Min(1, math.Sqrt(a)))
}
