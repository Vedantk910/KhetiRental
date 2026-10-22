#!/usr/bin/env python3
"""Integration run: execute the pinned check against the REAL skills tree.

Read-only. Writes two small input JSON files to this test dir, runs check.py
with SKILLS_DIR pointed at the real ~/.claude/skills, and asserts the expected
verdicts. No real skill is modified.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
CHECK = HERE.parent / "check.py"
PY = sys.executable

groups = {"groups": [
    {"name": "ui-ux-pro-max", "source_repo": "nextlevelbuilder/ui-ux-pro-max-skill",
     "skills": ["ui-ux-pro-max"], "needs_project": False, "blocked_hosts": [],
     "executables": [{"invocation": "python3 ~/.claude/skills/ui-ux-pro-max/scripts/search.py \"<q>\" --domain <d>",
                      "tested_offline": True, "note": "offline search engine"}]},
    {"name": "webapp-testing", "source_repo": "anthropics/skills",
     "skills": ["webapp-testing"], "needs_project": True, "blocked_hosts": []},
]}
env = dict(os.environ)

here_g = HERE / "integration_groups.json"
here_a = HERE / "integration_available.json"
here_g.write_text(json.dumps(groups))
here_a.write_text(json.dumps({"available_skills": ["ui-ux-pro-max", "webapp-testing"]}))

env["SKILLS_DIR"] = str(Path.home() / ".claude" / "skills")
cmd = [PY, str(CHECK), "--groups", str(here_g), "--available", str(here_a),
       "--feature", str(HERE.parent.parent)]
out = subprocess.run(cmd, env=env, capture_output=True, text=True)
if out.returncode != 0:
    print("check.py rc=", out.returncode); print(out.stderr); sys.exit(2)

report = json.loads(out.stdout)
print(json.dumps(report, indent=2))

by_group = {r["group"]: r["verdict"] for r in report["rows"]}
failures = []
def expect(actual, expected, label):
    ok = actual == expected
    print(f"  [{'ok' if ok else 'FAIL'}] {label}: expected={expected!r} got={actual!r}")
    if not ok:
        failures.append(label)

# ui-ux-pro-max is installed AND in the (supplied) available set -> verified
expect(by_group.get("ui-ux-pro-max"), "verified", "ui-ux-pro-max")
# webapp-testing is needs_project -> n-a-needs-project
expect(by_group.get("webapp-testing"), "n-a-needs-project", "webapp-testing")
# publish-flow: spec.md + 5 tickets exist under .scratch/skills-stack-e2e -> verified
expect(by_group.get("publish-flow"), "verified", "publish-flow")
# executable list names the UI/UX search invocation
exe = report["executable"]
assert any(e["invocation"].startswith("python3") and e["tested_offline"] for e in exe), "executable invocation missing"
print("  [ok] executable invocation recorded")

print()
if failures:
    print(f"RESULT: {len(failures)} FAILED: {', '.join(failures)}")
    sys.exit(1)
print("RESULT: integration assertions passed.")
