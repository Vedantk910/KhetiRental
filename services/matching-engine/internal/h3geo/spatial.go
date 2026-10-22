// Package h3geo implements Uber H3 spatial indexing for KhetiRental.
// Resolution 7/8/9 (per skills/go-systems-architect). Redis key: machines:h3:<cell>.
// No PostGIS, no Haversine on the write path.
package h3geo

import (
	"context"
	"fmt"
	"math"

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

// --- Redis backend -------------------------------------------------------

// RedisStore indexes machines into H3 cell sets.
// Key: machines:h3:<cellUint64>   value: machineID
//
// Write path: on machine location update, add/remove the machine ID.
// Read path: Pipeline of SMEMBERS over the k-ring. Amortised O(1).
type RedisStore struct {
	rdb *redis.Client
	res Res
}

// NewRedisStore returns a store at the requested H3 resolution.
func NewRedisStore(rdb *redis.Client, res Res) *RedisStore {
	return &RedisStore{rdb: rdb, res: res}
}

// Index adds a machine to the H3 cell set(s) it occupies (k-ring of radius k).
func (s *RedisStore) Index(ctx context.Context, machineID string, ll LatLon, k int) error {
	_, ring, err := NeighboursFromLatLon(ll, s.res, k)
	if err != nil {
		return err
	}
	pipe := s.rdb.Pipeline()
	for _, cell := range ring {
		pipe.SAdd(ctx, s.key(cell), machineID)
	}
	_, err = pipe.Exec(ctx)
	return err
}

// Near returns the machine IDs in the k-ring around ll. Amortised O(1)
// because k <= 5 keeps the pipeline small (max 37 keys at k=5).
func (s *RedisStore) Near(ctx context.Context, ll LatLon, k int) ([]string, error) {
	_, ring, err := NeighboursFromLatLon(ll, s.res, k)
	if err != nil {
		return nil, err
	}
	pipe := s.rdb.Pipeline()
	for _, cell := range ring {
		pipe.SMembers(ctx, s.key(cell))
	}
	cmds, err := pipe.Exec(ctx)
	if err != nil {
		return nil, err
	}
	seen := make(map[string]struct{})
	for _, cmd := range cmds {
		if cmd.Err() == redis.Nil || cmd.Err() != nil {
			continue
		}
		ids, err := cmd.Result()
		if err != nil {
			continue
		}
		for _, id := range ids {
			seen[id] = struct{}{}
		}
	}
	out := make([]string, 0, len(seen))
	for id := range seen {
		out = append(out, id)
	}
	return out, nil
}

// Unindex removes a machine from every cell in its k-ring.
func (s *RedisStore) Unindex(ctx context.Context, machineID string, ll LatLon, k int) error {
	_, ring, err := NeighboursFromLatLon(ll, s.res, k)
	if err != nil {
		return err
	}
	pipe := s.rdb.Pipeline()
	for _, cell := range ring {
		pipe.SRem(ctx, s.key(cell), machineID)
	}
	_, err = pipe.Exec(ctx)
	return err
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
