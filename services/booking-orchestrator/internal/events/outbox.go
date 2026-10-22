// Package events implements the transactional outbox + idempotent inbox
// that back the KhetiRental Kafka saga (per kafka-saga-orchestrator skill).
//
// Dual-write prohibition: every state mutation and its outgoing event are
// committed in the SAME database transaction into outbox_events. A
// publisher goroutine (or Debezium CDC) polls outbox_events and produces to
// Kafka with at-least-once delivery. Consumers atomically insert into
// processed_inbox_messages in the same transaction as their state update,
// which gives idempotent replay.
package events

import (
	"time"
)

// OutboxDDL is the PostgreSQL schema for the outbox + inbox tables.
const OutboxDDL = `
CREATE TABLE IF NOT EXISTS outbox_events (
    id              BIGSERIAL PRIMARY KEY,
    aggregate_type  TEXT NOT NULL,
    aggregate_id    TEXT NOT NULL,
    stream          TEXT NOT NULL,
    topic           TEXT NOT NULL,
    data            BYTEA NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_outbox_unpublished
    ON outbox_events (created_at) WHERE published_at IS NULL;

CREATE TABLE IF NOT EXISTS processed_inbox_messages (
    topic           TEXT NOT NULL,
    message_id      TEXT NOT NULL,
    processed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (topic, message_id)
);
`

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
