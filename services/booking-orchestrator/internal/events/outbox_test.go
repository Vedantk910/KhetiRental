package events

import (
	"testing"
	"time"
)

func TestNewPollerDefaultsInterval(t *testing.T) {
	if got := NewPoller(0).Interval(); got != 500*time.Millisecond {
		t.Fatalf("default interval %v", got)
	}
	if got := NewPoller(2 * time.Second).Interval(); got != 2*time.Second {
		t.Fatalf("explicit interval %v", got)
	}
}
