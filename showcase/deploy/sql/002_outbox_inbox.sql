-- Transactional outbox + idempotent inbox (kafka-saga-orchestrator skill).
-- A state change and its outbox row commit in the same transaction; the
-- publisher drains unpublished rows to Kafka (at-least-once). Consumers
-- insert into processed_inbox_messages in the same transaction as their
-- state update, so a redelivered message hits the primary key and is skipped.
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
