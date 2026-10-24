---
name: prd-contract-architect
description: Author executive Product Requirement Documents (PRDs), OpenAPI 3.1 YAML specifications, and Architecture Decision Records (ADRs). Use when defining product features, user journey funnels, API interface boundaries, or architectural decisions.
allowed-tools: [Bash, Edit, Write, Read, Grep]
metadata:
  track: "Track B (Vedant Konde - MiM / MSc Finance / PM / MBB)"
  target-role: "Product Management / Strategy / Elite B-School"
---
# PRD, OpenAPI & ADR Architectural Protocol
## 1. Product Requirements Document (PRD v2.0) Architecture
Every PRD authored under this skill must contain:
1. Executive Summary & Core Problem: Quantify mechanization deficit (86% smallholders under 2 ha, 38% informal broker markup, 12-day harvest window).
2. User Personas: Marginal Farmer (renter) vs. Custom Hiring Centre / Tractor Owner (lister).
3. 6-Stage User Journey: Search -> Escrow Pre-Auth -> Dispatch -> Telematics Active Window -> Inspection -> Settlement.
4. Edge Case Taxonomies: 2G offline dropouts, mid-lease machinery breakdown, weather delay, dispute escalation.
## 2. OpenAPI 3.1 & ADR Standards
- Contract Seam: `showcase/contracts/openapi.yaml` strictly defines all JSON schemas, mandatory Idempotency-Key headers, and error models.
- ADRs: Document all structural trade-offs in `showcase/docs/adr/` (ADR-001: Uber H3 vs PostGIS, ADR-002: Kafka Saga vs 2PC, ADR-003: 3-Stage Escrow vs Instant Capture, ADR-004: Dynamic Depreciation Pricing).
