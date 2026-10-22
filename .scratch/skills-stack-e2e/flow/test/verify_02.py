#!/usr/bin/env python3
"""Ticket 02 supporting evidence: idempotency, duplicate-name, invalid-frontmatter,
model-invocation-disabled, and blocked-host behaviours. All read-only / fixture-only."""
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

CHECK = Path(__file__).resolve().parent.parent / "check.py"
HERE = Path(__file__).resolve().parent.parent
PY = sys.executable
ok_all = True


def run(env, *extra):
    out = subprocess.run([PY, str(CHECK), *extra], capture_output=True, text=True, env=env)
    if out.returncode != 0:
        print(out.stderr)
    return json.loads(out.stdout)


# 1) idempotency on the real discovery inputs
env = dict(os.environ)
a = run(env, "--groups", str(HERE / "groups.json"), "--available", str(HERE / "available.json"))
b = run(env, "--groups", str(HERE / "groups.json"), "--available", str(HERE / "available.json"))
print("idempotent (identical verdicts both runs):", a == b, ok_all)
if a != b:
    ok_all = False

# 2) duplicate-name detection
with tempfile.TemporaryDirectory() as t:
    t = Path(t)
    (t / "dup-skill").mkdir()
    (t / "dup-skill" / "SKILL.md").write_text("---\nname: dup-skill\n---\nx")
    (t / "g.json").write_text(json.dumps({"groups": [
        {"name": "g1", "skills": ["dup-skill"]},
        {"name": "g2", "skills": ["dup-skill"]}]}, ensure_ascii=False))
    (t / "a.json").write_text(json.dumps({"available_skills": ["dup-skill"]}))
    e = dict(os.environ, SKILLS_DIR=str(t))
    rep = run(e, "--groups", str(t / "g.json"), "--available", str(t / "a.json"))
    print("duplicate detected:", rep["defects"], "| flagged as defect:",
          any("duplicate" in d for d in rep["defects"]))
    if not any("duplicate" in d for d in rep["defects"]):
        ok_all = False

# 3) invalid frontmatter flagged
with tempfile.TemporaryDirectory() as t:
    t = Path(t)
    (t / "bad-skill").mkdir()
    (t / "bad-skill" / "SKILL.md").write_text("# no frontmatter here\n")
    (t / "g.json").write_text(json.dumps({"groups": [{"name": "bad", "skills": ["bad-skill"]}]}, ensure_ascii=False))
    (t / "a.json").write_text(json.dumps({"available_skills": ["bad-skill"]}))
    e = dict(os.environ, SKILLS_DIR=str(t))
    rep = run(e, "--groups", str(t / "g.json"), "--available", str(t / "a.json"))
    print("invalid-frontmatter defect:", rep["defects"], "| flagged:",
          any("structural" in d for d in rep["defects"]))
    if not any("structural" in d for d in rep["defects"]):
        ok_all = False

# 4) model-invocation-disabled not reported as broken when absent from live set
with tempfile.TemporaryDirectory() as t:
    t = Path(t)
    (t / "slash-only").mkdir()
    (t / "slash-only" / "SKILL.md").write_text("---\nname: slash-only\ndisable-model-invocation: true\n---\nx")
    (t / "g.json").write_text(json.dumps({"groups": [
        {"name": "slash", "skills": ["slash-only"], "model_invocation_disabled": True}]}, ensure_ascii=False))
    (t / "a.json").write_text(json.dumps({"available_skills": []}))
    e = dict(os.environ, SKILLS_DIR=str(t))
    rep = run(e, "--groups", str(t / "g.json"), "--available", str(t / "a.json"))
    print("slash-only absent-from-live verdict:", rep["rows"][0]["verdict"],
          "| not reported as broken:", rep["rows"][0]["verdict"] != "failed")
    if rep["rows"][0]["verdict"] == "failed":
        ok_all = False

# 5) blocked host named, not retried
with tempfile.TemporaryDirectory() as t:
    t = Path(t)
    (t / "g.json").write_text(json.dumps({"groups": [
        {"name": "blocked-group", "skills": ["remote-skill"], "blocked_hosts": ["denied.example.com:443"]}]}, ensure_ascii=False))
    (t / "a.json").write_text(json.dumps({"available_skills": ["remote-skill"]}))
    e = dict(os.environ, SKILLS_DIR=str(t))
    rep = run(e, "--groups", str(t / "g.json"), "--available", str(t / "a.json"))
    print("blocked verdict + host named:", rep["rows"][0]["verdict"], "|", rep["rows"][0]["evidence"])
    if rep["rows"][0]["verdict"] != "blocked" or "denied.example.com" not in rep["rows"][0]["evidence"]:
        ok_all = False

print()
print("TICKET 02 EVIDENCE:", "ALL PASS" if ok_all else "FAILURES PRESENT")
sys.exit(0 if ok_all else 1)
