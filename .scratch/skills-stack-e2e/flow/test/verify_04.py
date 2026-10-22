#!/usr/bin/env python3
"""Ticket 04: validate the spec + 5 tickets against local-Markdown conventions.

Read-only. Asserts existence, required fields, valid ticket references, and basic
structure. File existence here is evidence of publishing, not proof the whole
workflow is correct.
"""
import re
import sys
from pathlib import Path

FEATURE = Path(__file__).resolve().parent.parent.parent  # .scratch/skills-stack-e2e
ok = True


def check(label, cond, detail=""):
    global ok
    mark = "ok" if cond else "FAIL"
    print(f"  [{mark}] {label}" + (f" — {detail}" if detail and not cond else ""))
    if not cond:
        ok = False


spec = FEATURE / "spec.md"
issues_dir = FEATURE / "issues"

# --- spec.md ---
check("spec.md exists at .scratch/<feature>/spec.md", spec.is_file())
if spec.is_file():
    text = spec.read_text(encoding="utf-8")
    check("spec carries a 'Status:' line", re.search(r"^Status:", text, re.M) is not None)
    check("spec status is ready-for-agent",
          "Status: ready-for-agent" in text or "Status: ready-for-agent" in text.replace("  ", " "))
    # required template sections
    for section in ("## Problem Statement", "## Solution", "## User Stories",
                    "## Implementation Decisions", "## Testing Decisions",
                    "## Out of Scope"):
        check(f"spec has '{section.strip('# ').strip()}' section", section in text)

# --- ticket files ---
tickets = sorted(issues_dir.glob("*.md")) if issues_dir.is_dir() else []
check("at least one ticket file under issues/", len(tickets) >= 1, f"found {len(tickets)}")

ticket_nums = []
for tf in tickets:
    ttext = tf.read_text(encoding="utf-8")
    m = re.match(r"^(\d+)", tf.name)
    num = int(m.group(1)) if m else None
    if num is not None:
        ticket_nums.append(num)
    check(f"{tf.name}: has '## <NN>:' title", re.match(r"^#\s*\d+:", ttext) is not None)
    check(f"{tf.name}: has 'What to build' field", "**What to build:**" in ttext)
    check(f"{tf.name}: has 'Blocked by' line", re.search(r"^\*\*Blocked by:\*\*", ttext, re.M) is not None)
    check(f"{tf.name}: has 'Status:' line", re.search(r"^\*\*Status:\*\*", ttext, re.M) is not None)
    # blocked-by references must be valid ticket numbers
    bm = re.search(r"^\*\*Blocked by:\*\*\s*(.+)$", ttext, re.M)
    if bm:
        val = bm.group(1).strip()
        if not val.startswith("None"):
            refs = [int(x) for x in re.findall(r"\b0*(\d+)\b", val)]
            valid = all(r in ticket_nums for r in refs)
            check(f"{tf.name}: 'Blocked by' refs valid ticket numbers", valid,
                  f"refs={refs} known={ticket_nums}")

# numbering from 01 in dependency order (blockers first): 01 must be first
if ticket_nums:
    check("tickets numbered from 01", min(ticket_nums) == 1, f"nums={sorted(ticket_nums)}")
    check("5 tickets present (01-05)", sorted(ticket_nums) == [1, 2, 3, 4, 5],
          f"nums={sorted(ticket_nums)}")

print()
print("TICKET 04 STRUCTURE:", "ALL PASS" if ok else "FAILURES PRESENT")
sys.exit(0 if ok else 1)
