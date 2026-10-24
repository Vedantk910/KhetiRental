"""Workflow hygiene: every `uses:` is pinned to a 40-char SHA, every workflow
sets `permissions:`. Run: python3 .github/test_workflows.py"""
import re, sys
from pathlib import Path
import yaml

SHA = re.compile(r"^[\w.-]+/[\w./-]+@[0-9a-f]{40}$")
files = sorted(Path(__file__).parent.glob("workflows/*.y*ml"))
errs = [] if files else ["no workflows found"]
for f in files:
    doc = yaml.safe_load(f.read_text())
    if "permissions" not in doc:
        errs.append(f"{f.name}: missing top-level permissions")
    for job, spec in doc["jobs"].items():
        for step in spec.get("steps", []):
            u = step.get("uses")
            if u and not SHA.match(u):
                errs.append(f"{f.name}:{job}: unpinned action {u}")
print("\n".join(errs) or f"ok {len(files)} workflows")
sys.exit(1 if errs else 0)
