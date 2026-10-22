# 03: Seam 2 — executable-script check

**What to build:** Confirmation that the skills' few executable pieces actually run, so the non-markdown parts of the stack are proven healthy — with project-dependent helpers honestly recorded as not-applicable rather than failed.

**Blocked by:** 01

**Status:** resolved

- [x] The UI/UX search engine is run offline with one query through the corrected `$HOME` path and returns a non-empty, correctly-shaped result.
- [x] The check reports the exact invocation command alongside each executable skill, so "how do I run it" is answered.
- [x] The webapp-testing server helper is recorded as `n-a-needs-project` (it needs a live web app that doesn't exist yet), not as a failure.
- [x] A project-dependent result is clearly separated from a verification-failure result in the report.

## Answer

**Exact invocation (documented corrected $HOME path):**
```bash
python3 "$HOME/.claude/skills/ui-ux-pro-max/scripts/search.py" "focusable error summary" --domain ux
```

**Actual output (non-empty, correctly-shaped):**
```
## UI Pro Max Search Results
**Domain:** ux | **Query:** focusable error summary
**Source:** ux-guidelines.csv | **Found:** 3 results

### Result 1
- **Category:** Forms / Accessibility
- **Issue:** Focusable Error Summary
- **Platform:** Web
...
```

**Check's executable sub-check** reports the invocation command per executable skill:
```json
{"group": "ui-ux-pro-max",
 "invocation": "python3 ~/.claude/skills/ui-ux-pro-max/scripts/search.py \"<query>\" --domain <domain>",
 "tested_offline": true,
 "note": "BM25 search over bundled CSV data; no network, no deps"}
```

**webapp-testing:** `python3 -c "import playwright"` → Traceback (no playwright installed); no running web app in this project. Recorded as `n-a-needs-project` via the check's `needs_project` flag (verdict `n-a-needs-project`, evidence "project-dependent; no target project to exercise this in-session") — **not** as a failure.

**Separation of project-dependent from failed:** the report's verdict vocabulary distinguishes `n-a-needs-project` from `failed` as two distinct values (`verdicts_used` lists all five; a `needs_project` group always resolves to `n-a-needs-project` regardless of the in-session list, confirmed in ticket 01's controlled tests).

Result: **PASS.** All four criteria met. No dependencies installed, no configuration changed.
