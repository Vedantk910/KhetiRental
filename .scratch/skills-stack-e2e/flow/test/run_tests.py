#!/usr/bin/env python3
"""Controlled tests for the pinned check flow (ticket 01).

Uses temporary fixture skill directories + JSON inputs; never touches the real
~/.claude/skills. Exits non-zero if any assertion fails.
"""
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).parent
CHECK = HERE.parent / "check.py"
PY = sys.executable or "python3"


def run_check(skill_dir, groups, available):
    env = dict(os.environ)
    env["SKILLS_DIR"] = str(skill_dir)
    cmd = [PY, str(CHECK), "--groups", str(groups)]
    if available is not None:
        cmd += ["--available", str(available)]
    out = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if out.returncode != 0:
        raise SystemExit(f"check.py failed (rc={out.returncode}):\n{out.stderr}")
    return json.loads(out.stdout)


def verdict_by_group(report, group):
    for r in report["rows"]:
        if r["group"] == group:
            return r["verdict"]
    return None


failures = []


def expect(actual, expected, label):
    ok = actual == expected
    print(f"  [{'ok' if ok else 'FAIL'}] {label}: expected={expected!r} got={actual!r}")
    if not ok:
        failures.append(label)


with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)

    # --- PASSING case: valid skill, in-session -> verified, overall all-pass ---
    good = tmp / "skills"
    (good / "fixture-good-skill").mkdir(parents=True)
    (good / "fixture-good-skill" / "SKILL.md").write_text("---\nname: fixture-good-skill\n---\nx\n")
    print("PASS case (valid + in-session -> verified, all-pass):")
    rep = run_check(good, HERE / "fixtures/pass/groups.json", HERE / "fixtures/pass/available.json")
    expect(rep["overall"], "all-pass", "overall")
    expect(verdict_by_group(rep, "fixture-good-skill"), "verified", "fixture-good-skill")

    # --- CONTROLLED-FAILURE cases (all in one groups file) ---
    bad = tmp / "skills2"
    bad.mkdir(parents=True)
    # present on disk, in session, but a broken symlink
    (bad / "fixture-broken-symlink").symlink_to(tmp / "does-not-exist")
    # present on disk but NOT in the available list
    (bad / "fixture-not-in-session").mkdir()
    (bad / "fixture-not-in-session" / "SKILL.md").write_text("---\nname: x\n---\n")
    # present on disk, in session, but its source host is denied -> blocked
    (bad / "fixture-denied-host").mkdir()
    (bad / "fixture-denied-host" / "SKILL.md").write_text("---\nname: x\n---\n")
    print("FAIL case (symlink / not-in-session / denied-host / needs-project):")
    rep = run_check(bad, HERE / "fixtures/fail/groups.json", HERE / "fixtures/fail/available.json")
    expect(rep["overall"], "any-gap", "overall any-gap")
    expect(verdict_by_group(rep, "fixture-broken-symlink"), "failed", "broken symlink -> failed")
    expect(verdict_by_group(rep, "fixture-not-in-session"), "installed-not-discoverable",
           "not-in-session -> installed-not-discoverable")
    expect(verdict_by_group(rep, "fixture-denied-host"), "blocked", "denied host -> blocked")
    expect(verdict_by_group(rep, "fixture-needs-project"), "n-a-needs-project",
           "needs project -> n-a-needs-project")

print()
if failures:
    print(f"RESULT: {len(failures)} assertion(s) FAILED: {', '.join(failures)}")
    sys.exit(1)
print("RESULT: all assertions passed.")
