// Package crdt implements the offline-first synchronization primitive for
// KhetiRental's rural 2G/3G telemetry path: a LWW-Element-Set (last-writer-
// wins element-set) CRDT.
//
// Why this design:
//   - Rural links drop and reorder packets; GPS/engine-hour telemetry
//     must converge regardless of delivery order. A CRDT guarantees
//     commutative, associative, idempotent merges (CAJA property).
//   - LWW-Element-Set gives us a per-metric last-value with a causally-
//     safe timestamp, so a late-arriving 2G frame can't clobber a newer
//     4G frame.
//   - Runs over WebSockets so the mobile app / on-vehicle OBD unit can
//     stream without a dedicated sync daemon.
//
// A clock is a (Lamport, nodeID) pair — Lamport count for the logical
// ordering, nodeID as a deterministic tie-breaker so two nodes that
// "disagree" still converge to the same winner.
package crdt

import (
	"sort"
	"sync"
)

// Clock is a logical timestamp: Lamport count + node id tie-breaker.
type Clock struct {
	Lamport uint64 `json:"lamport"`
	NodeID  string `json:"node"`
}

// After reports whether c is strictly later than o.
func (c Clock) After(o Clock) bool {
	if c.Lamport != o.Lamport {
		return c.Lamport > o.Lamport
	}
	return c.NodeID > o.NodeID
}

// Max returns the later of two clocks.
func (c Clock) Max(o Clock) Clock {
	if o.After(c) {
		return o
	}
	return c
}

// Element is one member of the set with its add/remove timestamps.
// A LWW-Element-Set keeps both an "added" and a "removed" clock per key;
// the element is present iff added.After(removed).
type Element struct {
	Key     string `json:"key"`
	Value   string `json:"value"`
	Added   Clock  `json:"added"`
	Removed Clock  `json:"removed"`
}

// Present reports whether the element is currently in the set.
func (e Element) Present() bool { return e.Added.After(e.Removed) }

// LWWElementSet is the CRDT. It is safe for concurrent use.
type LWWElementSet struct {
	mu       sync.RWMutex
	nodeID   string
	lamport  uint64
	elements map[string]Element
}

// NewLWWElementSet returns a fresh CRDT owned by nodeID.
func NewLWWElementSet(nodeID string) *LWWElementSet {
	return &LWWElementSet{
		nodeID:   nodeID,
		lamport:  0,
		elements: make(map[string]Element),
	}
}

// NodeID returns the owning node identifier.
func (s *LWWElementSet) NodeID() string { return s.nodeID }

// Add records the presence of key with a value, stamped with a fresh
// clock. It advances the local Lamport clock.
func (s *LWWElementSet) Add(key, value string) Clock {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.lamport++
	c := Clock{Lamport: s.lamport, NodeID: s.nodeID}
	el, ok := s.elements[key]
	if !ok {
		el = Element{Key: key}
	}
	el.Value = value
	el.Added = c
	s.elements[key] = el
	return c
}

// Remove records the removal of key, stamped with a fresh clock.
func (s *LWWElementSet) Remove(key string) Clock {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.lamport++
	c := Clock{Lamport: s.lamport, NodeID: s.nodeID}
	el, ok := s.elements[key]
	if !ok {
		el = Element{Key: key}
	}
	el.Removed = c
	s.elements[key] = el
	return c
}

// Contains reports whether key is currently present.
func (s *LWWElementSet) Contains(key string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	el, ok := s.elements[key]
	if !ok {
		return false
	}
	return el.Present()
}

// Merge folds another node's element set into this one. Merge is
// commutative and idempotent: merging the same remote set twice, or in
// reverse order, produces the same result — the property that makes
// out-of-order 2G delivery safe.
func (s *LWWElementSet) Merge(remote map[string]Element) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for key, rel := range remote {
		// Advance the local clock past every observed remote clock so the next
		// local Add/Remove is causally after it (Lamport receive rule).
		s.lamport = max(s.lamport, rel.Added.Lamport, rel.Removed.Lamport)
		local, ok := s.elements[key]
		if !ok {
			s.elements[key] = rel
			continue
		}
		if rel.Added.After(local.Added) {
			local.Added = rel.Added
			local.Value = rel.Value
		}
		if rel.Removed.After(local.Removed) {
			local.Removed = rel.Removed
		}
		s.elements[key] = local
	}
}

// Snapshot returns a copy of the current element set for sending to peers.
func (s *LWWElementSet) Snapshot() map[string]Element {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make(map[string]Element, len(s.elements))
	for k, v := range s.elements {
		out[k] = v
	}
	return out
}

// PresentKeys returns the set of keys currently present, sorted for
// deterministic iteration (used by the WS sync protocol and tests).
func (s *LWWElementSet) PresentKeys() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	keys := make([]string, 0, len(s.elements))
	for k, v := range s.elements {
		if v.Present() {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)
	return keys
}

// ValueAt returns the last-written value for a present key.
func (s *LWWElementSet) ValueAt(key string) (string, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	el, ok := s.elements[key]
	if !ok || !el.Present() {
		return "", false
	}
	return el.Value, true
}
