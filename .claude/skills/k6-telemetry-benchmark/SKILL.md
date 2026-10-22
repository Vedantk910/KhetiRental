---
name: k6-telemetry-benchmark
description: Author and execute k6 load testing scripts (5,000 VUs, p99 < 25ms SLAs), configure OpenTelemetry tracing in Go microservices, and design Prometheus/Grafana dashboards. Use when benchmarking throughput, measuring latency percentiles, or profiling distributed systems.
allowed-tools: [Bash, Edit, Write, Read, Grep]
metadata:
  track: "Track A (Brother - NIT Jaipur CSE)"
  target-role: "Core Distributed Systems SWE / FAANG"
---
# k6 & SRE Telemetry Protocol
## 1. k6 High-Throughput Load Script Spec
- Virtual Users (VUs): Ramp from 100 to 5,000 concurrent VUs over 60s; sustain 120s; ramp down 30s.
- Pass/Fail Thresholds:
  - `http_req_duration{status:200}: ['p(95)<10', 'p(99)<25']` (99% under 25ms).
  - `http_req_failed: ['rate<0.001']` (Failure rate strictly under 0.1%).
- OpenTelemetry spans must be injected across gateway and microservices for H3 spatial queries, Redis lock calls, and Kafka message propagation.
