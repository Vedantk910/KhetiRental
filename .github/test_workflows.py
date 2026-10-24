"""Workflow hygiene: every `uses:` is pinned to a 40-char SHA, every workflow
sets top-level `permissions:`. Standard library only. Run: python3 .github/test_workflows.py"""
import re
import sys
from pathlib import Path

SHA = re.compile(r"^[\w.-]+/[\w./-]+@[0-9a-f]{40}$")
USES = re.compile(r"^\s*(?:-\s+)?uses:\s*['\"]?([^\s'\"#]+)")
files = sorted(Path(__file__).parent.glob("workflows/*.y*ml"))
errs = [] if files else ["no workflows found"]
for f in files:
    lines = f.read_text().splitlines()
    if not any(re.match(r"^permissions:", line) for line in lines):
        errs.append(f"{f.name}: missing top-level permissions")
    for n, line in enumerate(lines, 1):
        m = USES.match(line)
        if m and not SHA.match(m.group(1)):
            errs.append(f"{f.name}:{n}: unpinned action {m.group(1)}")
print("\n".join(errs) or f"ok {len(files)} workflows")
sys.exit(1 if errs else 0)
