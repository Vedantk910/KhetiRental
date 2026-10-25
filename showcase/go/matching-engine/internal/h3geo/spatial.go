// Package h3geo implements Uber H3 spatial indexing for KhetiRental.
// Resolution 7/8/9 (per skills/go-systems-architect). Redis key: machines:h3:<cell>.
// No PostGIS, no Haversine on the write path.
package h3geo

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"strings"

	"github.com/redis/go-redis/v9"
	"github.com/uber/h3-go/v4"
)

// Res is a fixed H3 resolution tier.
type Res int

const (
	Res7 Res = 7 // ~1.2 km edge — district clustering
	Res8 Res = 8 // ~460 m  edge — village/farm cluster dispatch (DEFAULT)
	Res9 Res = 9 // ~174 m  edge — high-density parcel precision
)

// Cell is a typed wrapper around h3.Cell (uint64).
type Cell uint64

// LatLon is a WGS84 coordinate pair in degrees.
type LatLon struct{ Lat, Lng float64 }

// Neighbours returns the H3 k-ring cells around c (k in [1,5] per skill spec).
func (c Cell) Neighbours(k int) ([]Cell, error) {
	if k < 1 || k > 5 {
		return nil, fmt.Errorf("h3geo: k-ring %d out of supported range [1,5]", k)
	}
	cells, err := h3.GridDisk(h3.Cell(c), k)
	if err != nil {
		return nil, fmt.Errorf("h3geo: grid disk: %w", err)
	}
	out := make([]Cell, len(cells))
	for i, hc := range cells {
		out[i] = Cell(hc)
	}
	return out, nil
}

// NeighboursFromLatLon returns the anchor cell and its k-ring for a coordinate.
func NeighboursFromLatLon(ll LatLon, res Res, k int) (anchor Cell, ring []Cell, err error) {
	hc, err := h3.LatLngToCell(h3.NewLatLng(ll.Lat, ll.Lng), int(res))
	if err != nil {
		return 0, nil, fmt.Errorf("h3geo: latlon->cell: %w", err)
	}
	anchor = Cell(hc)
	ring, err = anchor.Neighbours(k)
	if err != nil {
		return 0, nil, err
	}
	return anchor, ring, nil
}

// Centroid returns the H3 cell centerpoint in degrees.
func (c Cell) Centroid() (LatLon, error) {
	ll, err := h3.CellToLatLng(h3.Cell(c))
	if err != nil {
		return LatLon{}, err
	}
	return LatLon{ll.Lat, ll.Lng}, nil
}

// RedisStore indexes machines into one Redis hash per H3 cell.
// Key: machines:h3:<cellUint64>   field: machineID   value: "lat,lng,hp,rep"
//
// Write path: HSET/HDEL on the machine's own cell only.
// Read path: one pipeline of HGETALL over the k-ring (max 91 keys at k=5);
// ranking attributes come back inline, so there is no second round trip.
type RedisStore struct {
	rdb *redis.Client
	res Res
}

// NewRedisStore returns a store at the requested H3 resolution.
func NewRedisStore(rdb *redis.Client, res Res) *RedisStore {
	return &RedisStore{rdb: rdb, res: res}
}

// Machine is an indexed machine with its ranking attributes.
type Machine struct {
	ID       string
	Location LatLon
	HP, Rep  float64
}

func (s *RedisStore) cellOf(ll LatLon) (Cell, error) {
	c, err := h3.LatLngToCell(h3.NewLatLng(ll.Lat, ll.Lng), int(s.res))
	if err != nil {
		return 0, fmt.Errorf("h3geo: latlon->cell: %w", err)
	}
	return Cell(c), nil
}

// Index stores m in the H3 cell it occupies. Proximity comes from the k-ring
// on the read path (Near), so the write path touches exactly one key.
func (s *RedisStore) Index(ctx context.Context, m Machine) error {
	cell, err := s.cellOf(m.Location)
	if err != nil {
		return err
	}
	v := fmt.Sprintf("%g,%g,%g,%g", m.Location.Lat, m.Location.Lng, m.HP, m.Rep)
	return s.rdb.HSet(ctx, s.key(cell), m.ID, v).Err()
}

// Unindex removes a machine from the cell at ll.
func (s *RedisStore) Unindex(ctx context.Context, machineID string, ll LatLon) error {
	cell, err := s.cellOf(ll)
	if err != nil {
		return err
	}
	return s.rdb.HDel(ctx, s.key(cell), machineID).Err()
}

// Near returns every machine indexed in the k-ring around ll.
func (s *RedisStore) Near(ctx context.Context, ll LatLon, k int) ([]Machine, error) {
	_, ring, err := NeighboursFromLatLon(ll, s.res, k)
	if err != nil {
		return nil, err
	}
	pipe := s.rdb.Pipeline()
	cmds := make([]*redis.MapStringStringCmd, len(ring))
	for i, cell := range ring {
		cmds[i] = pipe.HGetAll(ctx, s.key(cell))
	}
	if _, err := pipe.Exec(ctx); err != nil && err != redis.Nil {
		return nil, err
	}
	var out []Machine
	for _, cmd := range cmds {
		for id, v := range cmd.Val() {
			if f, ok := parse4(v); ok {
				out = append(out, Machine{ID: id, Location: LatLon{f[0], f[1]}, HP: f[2], Rep: f[3]})
			}
		}
	}
	return out, nil
}

// parse4 decodes the "lat,lng,hp,rep" value written by Index.
func parse4(v string) (f [4]float64, ok bool) {
	for i := range f {
		var part string
		part, v, _ = strings.Cut(v, ",")
		var err error
		if f[i], err = strconv.ParseFloat(part, 64); err != nil {
			return f, false
		}
	}
	return f, v == ""
}

func (s *RedisStore) key(c Cell) string {
	return "machines:h3:" + fmt.Sprint(uint64(c))
}

// HaversineKm is a pure-Go fallback used only for distance scoring in the
// ranker and in unit tests — never on the write path.
func HaversineKm(a, b LatLon) float64 {
	const r = 6371.0
	toRad := func(d float64) float64 { return d * math.Pi / 180 }
	dLat := toRad(b.Lat - a.Lat)
	dLng := toRad(b.Lng - a.Lng)
	lat1 := toRad(a.Lat)
	lat2 := toRad(b.Lat)
	h := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1)*math.Cos(lat2)*
			math.Sin(dLng/2)*math.Sin(dLng/2)
	return 2 * r * math.Asin(math.Min(1, math.Sqrt(h)))
}
