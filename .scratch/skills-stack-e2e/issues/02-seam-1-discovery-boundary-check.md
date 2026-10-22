# 02: Seam 1 — discovery-boundary check

**What to build:** Running the pinned check against all installed skills so the user can see, with evidence, which are genuinely discoverable by a live session versus merely present on disk. Structural defects must be caught and reported, not silently tolerated.

**Blocked by:** 01

**Status:** resolved

- [x] Every skill group is classified as `verified` (on disk **and** in the in-session list) or `installed-not-discoverable` (on disk only), with the evidence line stating which.
- [x] A skill with a missing or invalid-frontmatter `SKILL.md` is flagged as a structural defect.
- [x] Duplicate skill names that could shadow each other are flagged.
- [x] Broken symlinks among skill directories are treated as "undiscoverable" and flagged.
- [x] Skills that are intentionally model-invocation-disabled are NOT reported as broken.
- [x] The check is idempotent: running it twice yields the same verdicts.
- [x] Skills whose source the sandbox cannot reach are reported as `blocked` with the denied host named, not retried in a loop.

## Answer

The pinned check was run against the real `~/.claude/skills` inventory with the **live session's** available-skills list (captured into `flow/available.json` from this session's available-skills listing, not the filesystem inventory).

**Commands:**
```bash
# discovery run (real skills + live available set):
python3 .scratch/skills-stack-e2e/flow/check.py \
  --groups .scratch/skills-stack-e2e/flow/groups.json \
  --available .scratch/skills-stack-e2e/flow/available.json \
  --report .scratch/skills-stack-e2e/flow/report-02-discovery.json

# supporting evidence (fixture-only + read-only):
python3 .scratch/skills-stack-e2e/flow/test/verify_02.py
```

**Results:**
- Discovery run: `overall: all-pass`, **60/60 rows `verified`** across 7 groups (caveman 22, ui-ux-pro-max 7, karpathy-guidelines 1, matt-pocock 3, anthropic-document 4, anthropic-agent 16, vercel 7). Every skill is on disk **and** in the live session set. Zero structural defects in the real inventory.
- Invalid-frontmatter flag: fixture with `# no frontmatter` SKILL.md → `defects: ["structural defect: bad-skill SKILL.md missing/invalid"]`. PASSED.
- Duplicate-name flag: two groups sharing `dup-skill` → `defects: ["duplicate skill name: dup-skill (in groups: g1, g2)"]`. PASSED.
- Broken symlink: fixture broken-symlink → verdict `failed` + `defects: ["broken symlink: ..."]` (verified in ticket 01's controlled tests, unchanged). PASSED.
- Model-invocation-disabled: `slash-only` skill with empty live set → verdict `verified` with evidence "model-invocation-disabled; not auto-loaded by design" — **not** reported as broken. PASSED.
- Idempotency: two consecutive real runs produced byte-identical reports. PASSED.
- Blocked host: group with `blocked_hosts: [denied.example.com:443]` → verdict `blocked`, evidence "denied host(s): denied.example.com:443"; no retry loop. PASSED.

Result: **PASS.** All seven criteria met. Real inventory is clean: 60 verified, 0 defects.

Evidence files: `.scratch/skills-stack-e2e/flow/report-02-discovery.json`, `flow/groups.json`, `flow/available.json`, `flow/test/verify_02.py`.
