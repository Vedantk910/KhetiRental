---
name: git-guardrails-dual-track
description: Enforce strict dual-identity Git commit attribution, conventional commit validation, and deterministic blocking of destructive git commands (push --force, reset --hard). Use before committing, pushing, or staging changes.
allowed-tools: [Bash, Edit, Write, Read, Grep]
metadata:
  track: "Track C (System Integrity & Provenance)"
  target-role: "Zero-Leak Architectural Guardrail"
---
# Dual-Track Git Attribution Protocol
## 1. Author Attribution Verification
Verify active git author matches modified files before committing:
- Track A (Brother / NIT Jaipur CSE): Touching `showcase/go/matching-engine/`, `showcase/go/booking-orchestrator/`, `showcase/tests/load/`, `showcase/deploy/`. Conventional prefixes: `perf(geo):`, `feat(concurrency):`, `infra(k8s):`, `test(k6):`.
- Track B (Vedant Konde / Product & Risk): Touching `showcase/docs/PRD.md`, `showcase/contracts/openapi.yaml`, `showcase/docs/adr/`, `showcase/analytics/pricing.py`. Conventional prefixes: `docs(prd):`, `spec(api):`, `model(pricing):`, `feat(escrow-ui):`.
## 2. Prohibited Commands (Exit Code 2)
Any invocation of `git push --force`, `git push -f`, `git reset --hard`, `git clean -fd`, or `git branch -D` must be intercepted and rejected.
