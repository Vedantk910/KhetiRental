---
name: kafka-saga-orchestrator
description: Architect event-driven Saga state machines, Kafka producers/consumers, Transactional Outbox pattern, and idempotent inbox deduplication. Use when designing multi-service transactions, payment-booking coordination, or compensating workflows.
allowed-tools: [Bash, Edit, Write, Read, Grep]
metadata:
  track: "Track A (Brother - NIT Jaipur CSE)"
  target-role: "Core Distributed Systems SWE / FAANG"
---
# Kafka Saga Orchestrator Protocol
## 1. The Dual-Write Prohibition & Transactional Outbox
- Never write to database and publish to Kafka sequentially in application memory.
- Every state mutation and its outgoing event MUST be committed in the same database transaction to the `outbox_events` table.
- A publisher goroutine (or Debezium CDC) polls `outbox_events` and produces to Kafka with at-least-once delivery.
## 2. Orchestrated Saga State Machine
- Forward Path: ReserveInventory -> AuthorizeEscrowDeposit -> DispatchNotification.
- Compensating Path: If AuthorizeEscrowDeposit fails or times out (30s SLA), emit CompensateInventoryReservation to release Redlock / row hold, and transition state to FAILED_PAYMENT_RELEASED.
- Idempotency Mandate: Consumers execute atomic inserts into `processed_inbox_messages` in the same transaction as state updates.
