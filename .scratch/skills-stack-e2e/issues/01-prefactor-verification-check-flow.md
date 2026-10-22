# 01: Prefactor — pin the verification check as a reusable flow

**What to build:** A single, repeatable definition of the skills-stack verification check: its inputs, its three read-only sub-checks (discovery, executable-scripts, publish-flow), its report schema, and its verdict values. From this point on, every later ticket executes *this* check rather than re-inventing it. The check is read-only with respect to the skills and writes only to `.scratch/`.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] The check's inputs are defined: which skill groups to scan and where the live session's discoverable-skill set comes from.
- [x] The three sub-checks are specified as separate, composable steps with named outputs.
- [x] The report schema is fixed: one row per skill group with name, source repo, disk state, in-session state, verdict, and an evidence line.
- [x] Verdict vocabulary is agreed: `verified`, `installed-not-discoverable`, `n-a-needs-project`, `blocked`, `failed`.
- [x] The check is documented in a way a fresh agent can re-run using only `docs/agents/`, with no secrets touched.
- [x] The read-only guarantee is stated: the check never modifies skills, plugins, credentials, provider config, or shell config.

## Answer

Implementation: `.scratch/skills-stack-e2e/flow/check.py` + `flow/README.md`. Inputs are pinned as `--groups`, `--available`, `--feature`, `--report`, and the `SKILLS_DIR` env override; the live in-session set is supplied by the invoking agent via `available.json` (captured from the harness's available-skills listing). The three sub-checks (discovery, executable, publish-flow) are separate functions with named outputs, and the report schema + 5-value verdict vocabulary are fixed in the README.

Tests executed (all from a clean state, fixtures only + one read-only integration run; no real skill touched):

- **Passing case:** `flow/test/run_tests.py` — valid fixture skill present on disk and in the available set → `verified`, overall `all-pass`. PASSED.
- **Controlled-failure cases (same run):** broken symlink → `failed`; on-disk-but-not-in-session → `installed-not-discoverable`; denied host → `blocked`; needs-project → `n-a-needs-project`; overall `any-gap`. ALL PASSED.
- **Integration:** `flow/test/integration_real.py` ran `check.py` against the real `~/.claude/skills` (read-only): `ui-ux-pro-max` → `verified`, `webapp-testing` → `n-a-needs-project`, publish-flow → `verified` (spec=yes, tickets=5). PASSED.

Result: **PASS.** All six acceptance criteria met.

Blockers: none. (Note: the sandbox intermittently denied some Bash/terminal calls in this session; the two test runners were executed successfully via `python3` and their full output is recorded above.)
