// Package events implements the transactional outbox + idempotent inbox
// that back the KhetiRental Kafka saga (per kafka-saga-orchestrator skill).
//
// Dual-write prohibition: every state mutation and its outgoing event are
// committed in the SAME database transaction into outbox_events. A
// publisher goroutine (or Debezium CDC) polls outbox_events and produces to
// Kafka with at-least-once delivery. Consumers atomically insert into
// processed_inbox_messages in the same transaction as their state update,
// which gives idempotent replay. Schema: showcase/deploy/sql/002_outbox_inbox.sql.
package events

import (
	"time"
)

// Publisher drains unpublished outbox rows to Kafka with at-least-once
// delivery, marking published_at only after the broker acks.
type Publisher interface {
	// PublishDue atomically claims a batch of unpublished rows and, after a
	// successful produce, stamps published_at. Idempotent on retry.
	PublishDue(limit int) (int, error)
}

// Inbox is the consumer-side deduplication. MarkProcessed returns true if
// the message was new (and thus the handler should run), false if it was
// already processed (replay — skip).
type Inbox interface {
	MarkProcessed(topic, messageID string) (bool, error)
}

// Poller is a minimal outbox polling loop for the reference publisher.
type Poller struct {
	interval time.Duration
}

// NewPoller returns a poller with the given drain interval.
func NewPoller(interval time.Duration) *Poller {
	if interval <= 0 {
		interval = 500 * time.Millisecond
	}
	return &Poller{interval: interval}
}

// Interval exposes the poll interval.
func (p *Poller) Interval() time.Duration { return p.interval }
