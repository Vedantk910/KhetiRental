"""Doc integrity check (run: python3 docs/check_docs.py).

1. docs/PRD.md carries every section the prd-contract-architect skill requires
   and references every escrow dispute rule D-01..D-07.
2. Every relative Markdown link in the repo's docs resolves to a real file.
3. The booking state set is identical in contracts/openapi.yaml, the Kafka
   booking event schema, the saga's BookingState constants and the bookings
   CHECK in deploy/sql (every copy of the contract).
Exits non-zero on any failure.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PRD = ROOT / "docs" / "PRD.md"

REQUIRED_PRD_HEADINGS = [
    "Executive Summary",
    "Personas",
    "User Journey",
    "Edge Case",
    "Success Metrics",
    "Open Questions",
]
DOC_GLOBS = ["*.md", "docs/**/*.md", "contracts/**/*.md", "deploy/**/*.md"]
LINK = re.compile(r"\[[^\]]*\]\(([^)\s#]+)(?:#[^)]*)?\)")


def check_prd() -> list[str]:
    if not PRD.exists():
        return ["docs/PRD.md missing"]
    text = PRD.read_text()
    headings = [l for l in text.splitlines() if l.startswith("#")]
    errs = [f"PRD missing section: {h}" for h in REQUIRED_PRD_HEADINGS
            if not any(h.lower() in x.lower() for x in headings)]
    errs += [f"PRD does not reference dispute rule D-0{i}" for i in range(1, 8)
             if f"D-0{i}" not in text]
    return errs


def check_links() -> list[str]:
    errs = []
    files = {p for g in DOC_GLOBS for p in ROOT.glob(g)}
    for md in sorted(files):
        for target in LINK.findall(md.read_text()):
            if re.match(r"^[a-z]+:", target):  # http:, mailto:, ...
                continue
            if not (md.parent / target).resolve().exists():
                errs.append(f"{md.relative_to(ROOT)}: broken link -> {target}")
    return errs


def booking_states() -> dict[str, set[str]]:
    api = (ROOT / "contracts/openapi.yaml").read_text()
    block = api.split("    Booking:\n", 1)[1].split("    Settlement:", 1)[0]
    go = (ROOT / "services/booking-orchestrator/internal/saga/saga.go").read_text()
    sql = " ".join(p.read_text() for p in sorted((ROOT / "deploy/sql").glob("[0-9]*.sql")))
    # The newest CHECK on bookings.state wins (later migrations replace it).
    checks = re.findall(r"state\s+IN\s*\(([^)]*)\)", sql)
    events = json.loads((ROOT / "contracts/events/booking.events.json").read_text())
    return {
        "contracts/openapi.yaml": set(re.findall(r"^\s+- ([A-Z_]+)$", block, re.M)),
        "contracts/events/booking.events.json": set(events["properties"]["state"]["enum"]),
        "saga.go BookingState": set(re.findall(r'BookingState = "([A-Z_]+)"', go)),
        "deploy/sql bookings CHECK": set(re.findall(r"'([A-Z_]+)'", checks[-1])) if checks else set(),
    }


def check_state_enums() -> list[str]:
    sets = booking_states()
    union = set().union(*sets.values())
    return [f"{name} is missing booking states: {sorted(union - s)}" for name, s in sets.items() if union - s]


if __name__ == "__main__":
    errors = check_prd() + check_links() + check_state_enums()
    for e in errors:
        print("  FAIL", e)
    print("FAIL docs" if errors else "PASS docs")
    sys.exit(1 if errors else 0)
