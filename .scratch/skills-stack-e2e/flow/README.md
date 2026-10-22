# skills-stack-e2e verification check (ticket 01: pinned reusable flow)

A single, repeatable, **read-only** definition of the skills-stack verification
check. Later tickets (02–05) execute *this* check rather than re-inventing it.

## Guarantees

- Read-only with respect to skills, plugins, credentials, provider config, and
  shell config. Its only writes are under `.scratch/` (the report file, when
  given).
- Blockers are data: a sandbox denial or "no target project" is a first-class
  verdict value, not a crash or a retry loop.
- Idempotent: running it twice yields the same verdicts.
- A fresh agent can re-run it using only `docs/agents/` (the tracker doc points
  to `.scratch/<feature>/`) and this `flow/` folder.

## Inputs

| Input | Meaning | Default |
|---|---|---|
| `--groups <path.json>` | Which skill groups to scan: name, source_repo, skills, needs_project, blocked_hosts, executables | required |
| `--available <path.json>` | The live session's discoverable-skill set: `{"available_skills": [...]}` | optional; if omitted, discovery is reported as `blocked` (not proven), not failed |
| `--feature <dir>` | A `.scratch/<feature>` dir for the publish-flow sub-check | optional |
| `--report <path>` | Where to write the report JSON (must be under `.scratch/`) | optional (otherwise stdout only) |
| `SKILLS_DIR` (env) | Override the skill root | `~/.claude/skills` |

## Sub-checks (composed, each with a named output)

1. **discovery** → one report row per skill group. Proof of "works" = the skill
   is in the in-session list **and** its `SKILL.md` frontmatter is parseable.
   Structural defects: missing/invalid `SKILL.md`, duplicate names, broken
   symlinks.
2. **executable** → per-group list of executable skills with their exact
   invocation commands (offline-testable ones marked `tested_offline`).
3. **publish-flow** → one report row proving the `.scratch/` tracker
   destination exists and is well-formed (spec present + ≥1 ticket).

## Verdict vocabulary (fixed)

`verified` | `installed-not-discoverable` | `n-a-needs-project` | `blocked` | `failed`

- `verified` — on disk **and** in-session **and** frontmatter valid.
- `installed-not-discoverable` — on disk but not in the live session set.
- `n-a-needs-project` — project-dependent; cannot be exercised without a codebase.
- `blocked` — a source host the sandbox denies (named in evidence), or no live
  set was supplied.
- `failed` — a structural defect (e.g. broken symlink, missing SKILL.md).

## Report schema

One JSON object:

```json
{
  "overall": "all-pass | any-gap",
  "verdicts": { "verified": N, "blocked": N, ... },
  "defects": [ "structural-defect strings", ... ],
  "rows": [
    {
      "group": "ui-ux-pro-max",
      "source_repo": "nextlevelbuilder/ui-ux-pro-max-skill",
      "disk_state": "present|absent|broken-symlink|unknown",
      "in_session_state": "present|absent|unknown",
      "verdict": "verified|installed-not-discoverable|n-a-needs-project|blocked|failed",
      "evidence": "disk=present in-session=yes"
    }
  ],
  "executable": [ { "group": "...", "invocation": "...", "tested_offline": true, "note": "..." } ],
  "verdicts_used": ["verified", "installed-not-discoverable", "n-a-needs-project", "blocked", "failed"]
}
```

`overall` is `all-pass` iff no row has a gap verdict (`failed`, `blocked`,
`installed-not-discoverable`).

## Re-run

```bash
# discovery + executable + publish-flow, writing an auditable report:
python3 .scratch/skills-stack-e2e/flow/check.py \
  --groups .scratch/skills-stack-e2e/flow/groups.json \
  --available .scratch/skills-stack-e2e/flow/available.json \
  --feature .scratch/skills-stack-e2e \
  --report .scratch/skills-stack-e2e/flow/report.json

# self-test (passing + controlled-failure cases, fixture-only, no real skills touched):
python3 .scratch/skills-stack-e2e/flow/test/run_tests.py
```

`available.json` is what the live session's discoverable-skill set is pinned to
for a run; the in-session set itself comes from the harness's available-skills
listing, captured into that file by the invoking agent before running the check.
