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

import "math"

// GeofenceRadiusM is the default breach distance from the registered parcel.
const GeofenceRadiusM = 500.0

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

// Breach reports whether the machine is outside the registered parcel.
func Breach(p Parcel, m MachinePoint) bool {
	d := haversineM(p.CentroidLat, p.CentroidLng, m.Lat, m.Lng)
	allow := p.RadiusM
	if allow <= 0 {
		allow = GeofenceRadiusM
	}
	return d > allow
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
	return diff/base > HourTamperThreshold
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
