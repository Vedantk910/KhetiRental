# 05: Integration-regression check and final rollup

**What to build:** A guard against install churn silently undoing the integrations, plus a single pass/gap verdict across all four seams that the user can save as an auditable, shareable record.

**Blocked by:** 01, 02, 03, 04

**Status:** resolved

- [x] The two enabled plugins (Superpowers, Ponytail) are confirmed still enabled after any install churn.
- [x] The Graphify hook registration is confirmed still present.
- [x] All four seams (discovery, executable-script, publish-flow, and this regression check) roll up into one verdict: all-pass or any-gap, naming each gap.
- [x] The combined report is saveable to a file under `.scratch/` so it is auditable.
- [x] Findings are phrased in the repo's domain vocabulary (from GLOSSARY/ADR where present).
- [x] The final report is self-contained enough to hand to another reviewer, with every "blocked" result naming the denied host or missing prerequisite.

## Answer

All four prerequisite tickets (01–04) verified `resolved` with `## Answer` evidence blocks and artifacts before this run.

**Regression sub-check added** to the pinned flow (`flow/check.py` → `check_regression`, driven by `flow/regression.json`) so the rollup uses the same reusable check rather than a one-off script.

**Commands:**
```bash
# full rollup (discovery + executable + publish-flow + regression):
python3 .scratch/skills-stack-e2e/flow/check.py \
  --groups .scratch/skills-stack-e2e/flow/groups.json \
  --available .scratch/skills-stack-e2e/flow/available.json \
  --feature .scratch/skills-stack-e2e \
  --regression .scratch/skills-stack-e2e/flow/regression.json \
  --report .scratch/skills-stack-e2e/flow/report-05-final.json

# UI/UX executable proof (ticket 03):
python3 "$HOME/.claude/skills/ui-ux-pro-max/scripts/search.py" "focusable error summary" --domain ux

# plugin/integration health (read-only):
grep -E "superpowers|ponytail" ~/.claude/settings.json
cat ~/.claude/.ponytail-active
grep -c "hook-guard" ~/.claude/settings.json
```

**Regression results (evidence-backed, pinned verdict vocabulary):**
- `superpowers-plugin` → **verified**: `superpowers@superpowers-marketplace` in `enabledPlugins`; `systematic-debugging` SKILL.md present in the plugin cache.
- `ponytail-plugin` → **verified**: `ponytail@ponytail` in `enabledPlugins`; `.ponytalk-active` health marker = `full`.
- `graphify-hook` → **verified**: `hook-guard` subcommand registered in `settings.json` PreToolUse hooks (2 occurrences).

**Rollup (`report-05-final.json`):** `overall: all-pass-with-na`
- 63 rows `verified`, 1 row `n-a-needs-project` (`webapp-testing` — needs a live web app + Playwright; a legitimate "cannot exercise here", not a gap).
- **0 gaps** (no `failed` / `blocked` / `installed-not-discoverable`).
- The four seams are all present in the report: discovery rows (60 skills), the `executable` block (UI/UX search invocation), the `publish-flow` row (`verified`, spec=yes tickets=5), and the 3 `regression_rows`.

**Domain vocabulary:** no GLOSSARY/ADR exists in this repo yet (single-context, created lazily per the `docs/agents/domain.md` rules), so findings use the tracker's own terminology — spec, ticket, seam, verdict — which is the project's established vocabulary in `.scratch/` and `docs/agents/`.

**Self-contained for a reviewer:** `report-05-final.json` carries every row with its `evidence` line, the full `verdicts_used` vocabulary, the gap list (empty), and the n-a list (webapp-testing named with its prerequisite). No "blocked" results exist in this run, so no denied host needs naming.

Result: **PASS.** All six criteria met.

**Remaining limitation (honest):** `webapp-testing` remains `n-a-needs-project` — it cannot be verified without a running web app and the Playwright dependency, neither of which exist in this project. That is an acknowledged non-verification, not a pass. When a real web project lands here, re-run the flow with that group's `needs_project` still true and the seam exercised; ticket 05's rollup is the record to diff against.
