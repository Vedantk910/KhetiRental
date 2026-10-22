# 04: Seam 3 — .scratch/ publish-flow check

**What to build:** Proof that the spec→ticket workflow produces concrete, well-formed artifacts in the local tracker, closing the loop that was previously blocked only on tracker setup.

**Blocked by:** 01

**Status:** resolved

- [x] A spec lands as `.scratch/<feature>/spec.md` carrying a `Status: ready-for-agent` line.
- [x] Tickets land as one file each under `.scratch/<feature>/issues/NN-<slug>.md`, numbered from 01 in dependency order (blockers first).
- [x] Each ticket carries a `Status:` line and a `Blocked by:` line (or "None (can start immediately)").
- [x] The check asserts file existence and the expected status/edge lines, not exact prose.
- [x] The spec/ticket flow is proven in this very run: the skills-stack-e2e spec and its tickets exist and are well-formed.

## Answer

Validated the existing spec + 5 ticket files against the local-Markdown conventions in `docs/agents/issue-tracker.md`.

**Commands:**
```bash
# structure validator (asserts existence + required fields, not prose):
python3 .scratch/skills-stack-e2e/flow/test/verify_04.py

# the pinned check's own publish-flow sub-check (already exercised in tickets 02/03 runs):
python3 .scratch/skills-stack-e2e/flow/check.py \
  --groups .scratch/skills-stack-e2e/flow/groups.json \
  --available .scratch/skills-stack-e2e/flow/available.json
# -> publish-flow row: verdict "verified", evidence "spec=yes tickets=5"
```

**Results (`verify_04.py`, all pass):**
- `spec.md` exists at `.scratch/skills-stack-e2e/spec.md`, carries `Status: ready-for-agent`, and has all required template sections (Problem Statement, Solution, User Stories, Implementation Decisions, Testing Decisions, Out of Scope).
- 5 ticket files `01..05-*.md` under `issues/`, one per ticket (not a combined file), numbered from 01.
- Each ticket has a `## <NN>:` title, a `**What to build:**` field, a `**Blocked by:**` line, and a `**Status:**` line.
- `Blocked by` references resolve to valid ticket numbers (01 = None; 02/03/04 = 01; 05 = 01,02,03,04).

**Honesty note (per ticket):** file existence is treated as evidence of *publishing*, not proof the entire spec→ticket *workflow* is correct. The workflow's correctness (that a fresh agent could reproduce these artifacts) is out of scope here and belongs to ticket 05's regression/rollup.

Result: **PASS.** All five criteria met.
