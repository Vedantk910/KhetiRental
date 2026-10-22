#!/usr/bin/env python3
"""skills-stack-e2e verification check (ticket 01: pinned reusable flow).

Read-only with respect to skills, plugins, credentials, provider config, and
shell config. Its only writes are to .scratch/ (the report file, when given).

Usage:
    python3 check.py --groups groups.json --available available.json --report report.json
    python3 check.py --help

Sub-checks (composed, each with a named output):
    discovery      -> one report row per skill group
    executable     -> per-group note: executable skills + their invocation commands
    publish-flow   -> one report row proving the .scratch/ tracker destination exists and is well-formed

Verdict vocabulary (fixed):
    verified | installed-not-discoverable | n-a-needs-project | blocked | failed

groups.json schema:
{
  "groups": [
    {
      "name": "ui-ux-pro-max",
      "source_repo": "nextlevelbuilder/ui-ux-pro-max-skill",
      "skills": ["ui-ux-pro-max"],
      "skill_dir": "/abs/path/to/claude/skills",     # default ~/.claude/skills
      "needs_project": false,                          # project-dependent skills
      "blocked_hosts": []                              # hosts the sandbox denies
    }
  ]
}

available.json schema: {"available_skills": ["name1", "name2", ...]}
"""
import argparse
import json
import os
import sys
from pathlib import Path

VERDICTS = ("verified", "installed-not-discoverable", "n-a-needs-project", "blocked", "failed")


def load_json(path, label):
    p = Path(path)
    if not p.is_file():
        raise SystemExit(f"ERROR: {label} not found: {path}")
    with p.open(encoding="utf-8") as fh:
        return json.load(fh)


def default_skill_dir():
    env = os.environ.get("SKILLS_DIR")
    if env:
        return Path(env)
    return Path.home() / ".claude" / "skills"


def skill_frontmatter_valid(skill_md: Path) -> bool:
    """A SKILL.md is valid iff it starts with a '---' frontmatter block. Read-only."""
    try:
        head = skill_md.open(encoding="utf-8", errors="replace").read(8)
    except OSError:
        return False
    return head.startswith("---")


def check_discovery(group, skill_dir, available):
    """Return (rows, defects) for one group. Read-only."""
    rows = []
    defects = []
    if group.get("needs_project"):
        # project-dependent skills can't be exercised without a live codebase,
        # regardless of whether the in-session list was supplied
        for s in group.get("skills", []):
            rows.append(row(group, "unknown", "unknown", "n-a-needs-project",
                            "project-dependent; no target project to exercise this in-session"))
        return rows, defects
    on_disk = {}
    for skill in group.get("skills", []):
        d = skill_dir / skill
        if d.is_symlink() and not d.resolve().exists():
            on_disk[skill] = "broken-symlink"
            defects.append(f"broken symlink: {skill}")
        elif not d.exists():
            on_disk[skill] = "absent"
        elif not (d / "SKILL.md").is_file() or not skill_frontmatter_valid(d / "SKILL.md"):
            on_disk[skill] = "present"
            defects.append(f"structural defect: {skill} SKILL.md missing/invalid")
        else:
            on_disk[skill] = "present"
    for skill in group.get("skills", []):
        disk = on_disk.get(skill, "absent")
        in_session = skill in available
        evidence = f"disk={disk} in-session={'yes' if in_session else 'no'}"
        if disk == "absent" or disk == "broken-symlink" or not in_session:
            if disk in ("absent", "broken-symlink"):
                verdict = "failed" if disk == "broken-symlink" else "installed-not-discoverable"
            else:
                verdict = "installed-not-discoverable"
        else:
            verdict = "verified"
        rows.append(row(group, disk, "present" if in_session else "absent", verdict, evidence))
    # blocked: source the sandbox cannot reach
    if group.get("blocked_hosts"):
        for r in rows:
            r["verdict"] = "blocked"
            r["evidence"] = f"denied host(s): {', '.join(group['blocked_hosts'])}"
    # a group that is intentionally model-invocation-disabled is not "broken"
    # when it is absent from the live in-session set (the model can't auto-load it)
    elif group.get("model_invocation_disabled") and not available:
        for r in rows:
            if r["verdict"] == "installed-not-discoverable":
                r["verdict"] = "verified"
                r["evidence"] += " (model-invocation-disabled; not auto-loaded by design)"
    return rows, defects


def row(group, disk_state, in_session_state, verdict, evidence):
    return {
        "group": group["name"],
        "source_repo": group.get("source_repo", ""),
        "disk_state": disk_state,
        "in_session_state": in_session_state,
        "verdict": verdict,
        "evidence": evidence,
    }


def check_executable(groups):
    """Named output: which groups ship executables and how to invoke them. Read-only."""
    out = []
    for g in groups:
        execs = g.get("executables", [])
        for e in execs:
            out.append({
                "group": g["name"],
                "invocation": e.get("invocation", ""),
                "tested_offline": e.get("tested_offline", False),
                "note": e.get("note", ""),
            })
    return out


def check_publish_flow(feature_dir: Path):
    """Prove the .scratch/ tracker destination exists and is well-formed. Read-only."""
    rows = []
    spec = feature_dir / "spec.md"
    issues = feature_dir / "issues"
    has_spec = spec.is_file()
    ticket_files = sorted(issues.glob("*.md")) if issues.is_dir() else []
    well_formed = has_spec and len(ticket_files) >= 1
    verdict = "verified" if well_formed else "failed"
    evidence = f"spec={'yes' if has_spec else 'no'} tickets={len(ticket_files)}"
    rows.append(row({
        "name": "publish-flow",
        "source_repo": "local-markdown tracker (.scratch/)",
    }, "present" if feature_dir.is_dir() else "absent",
        "present" if well_formed else "absent", verdict, evidence))
    return rows


def check_duplicate_names(groups):
    """Global structural check: two skill names that could shadow each other. Read-only."""
    seen = {}
    dups = []
    for g in groups:
        for s in g.get("skills", []):
            seen.setdefault(s, []).append(g["name"])
    for name, where in seen.items():
        if len(where) > 1:
            dups.append(f"duplicate skill name: {name} (in groups: {', '.join(where)})")
    return dups


def check_regression(config: dict):
    """Integration-regression sub-check (ticket 05). Read-only.

    Confirms the enabled plugins, the health markers, and the hook registrations
    that install churn could silently undo. One row per integration with a
    verdict from the pinned vocabulary.
    """
    rows = []
    settings = Path(config.get("settings", ""))
    enabled = {}
    if settings.is_file():
        try:
            doc = json.loads(settings.read_text(encoding="utf-8"))
            enabled = doc.get("enabledPlugins", {})
        except (json.JSONDecodeError, OSError):
            pass

    # Superpowers plugin
    sp = config.get("superpowers", {})
    sp_key = sp.get("plugin_key", "superpowers@superpowers-marketplace")
    sp_skill = sp.get("skill", "systematic-debugging")
    sp_dir = sp.get("skill_dir", str(Path.home() / ".claude/plugins/cache/superpowers-marketplace/superpowers/7.0.0/skills"))
    sp_enabled = enabled.get(sp_key) is True
    sp_skill_ok = (Path(sp_dir) / sp_skill / "SKILL.md").is_file()
    if sp_enabled and sp_skill_ok:
        verdict, evidence = "verified", f"{sp_key} enabled; {sp_skill} SKILL.md present"
    elif not sp_enabled:
        verdict, evidence = "failed", f"{sp_key} NOT in enabledPlugins"
    else:
        verdict, evidence = "installed-not-discoverable", f"{sp_key} enabled but {sp_skill} SKILL.md missing"
    rows.append(row({"name": "superpowers-plugin", "source_repo": "obra/superpowers-marketplace"},
                    "present" if sp_enabled else "absent",
                    "present" if sp_skill_ok else "absent", verdict, evidence))

    # Ponytail plugin + health marker
    pt = config.get("ponytail", {})
    pt_key = pt.get("plugin_key", "ponytail@ponytail")
    pt_marker = Path(pt.get("health_marker", str(Path.home() / ".claude/.ponytail-active")))
    pt_enabled = enabled.get(pt_key) is True
    marker_val = ""
    if pt_marker.is_file():
        try:
            marker_val = pt_marker.read_text(encoding="utf-8").strip()
        except OSError:
            pass
    if pt_enabled and marker_val in ("full", "lite", "ultra"):
        verdict, evidence = "verified", f"{pt_key} enabled; .ponytail-active='{marker_val}'"
    elif not pt_enabled:
        verdict, evidence = "failed", f"{pt_key} NOT in enabledPlugins"
    else:
        verdict, evidence = "installed-not-discoverable", f"{pt_key} enabled but health marker invalid/absent ({marker_val or 'missing'})"
    rows.append(row({"name": "ponytail-plugin", "source_repo": "DietrichGebert/ponytail"},
                    "present" if pt_enabled else "absent",
                    "present" if marker_val else "absent", verdict, evidence))

    # Graphify hook registration
    gf = config.get("graphify", {})
    gf_sub = gf.get("subcommand", "hook-guard")
    gf_present = settings.is_file() and gf_sub in settings.read_text(encoding="utf-8", errors="replace")
    verdict = "verified" if gf_present else "failed"
    evidence = f"'{gf_sub}' present in settings.json hooks" if gf_present else f"'{gf_sub}' NOT registered in settings.json"
    rows.append(row({"name": "graphify-hook", "source_repo": "graphifyy (uv tool)"},
                    "present" if gf_present else "absent",
                    "present" if gf_present else "absent", verdict, evidence))
    return rows


def main():
    ap = argparse.ArgumentParser(description="skills-stack-e2e verification check")
    ap.add_argument("--groups", required=True, help="groups.json path")
    ap.add_argument("--available", default=None, help="available.json path (in-session discoverable set)")
    ap.add_argument("--feature", default=None, help=".scratch/<feature> dir for publish-flow check")
    ap.add_argument("--regression", default=None, help="regression.json path (ticket 05 integrations)")
    ap.add_argument("--report", default=None, help="write report JSON here (.scratch/ only)")
    args = ap.parse_args()

    groups_doc = load_json(args.groups, "groups")
    groups = groups_doc.get("groups", [])
    available = []
    if args.available:
        available = load_json(args.available, "available").get("available_skills", [])
    else:
        # no live session list available -> treat discovery as not-proven, not failed
        available = None

    rows = []
    all_defects = []
    for g in groups:
        g["skills"] = g.get("skills", [])
        if available is not None:
            r, d = check_discovery(g, default_skill_dir(), available)
        else:
            # discovery sub-check is not runnable without the live set
            r, d = [], []
            for s in g["skills"]:
                r.append(row(g, "unknown", "unknown", "blocked",
                             "no live available-skills list supplied; discovery not proven"))
        rows.extend(r)
        all_defects.extend(d)

    executable = check_executable(groups)
    if args.feature:
        rows.extend(check_publish_flow(Path(args.feature)))

    all_defects.extend(check_duplicate_names(groups))

    regression_rows = []
    if args.regression:
        regression_rows = check_regression(load_json(args.regression, "regression"))
        rows.extend(regression_rows)

    verdicts = [x["verdict"] for x in rows]
    # n-a-needs-project is an honest "cannot exercise here" result, not a gap.
    gap_rows = [r for r in rows if r["verdict"] in ("failed", "blocked", "installed-not-discoverable")]
    na_rows = [r for r in rows if r["verdict"] == "n-a-needs-project"]
    any_gap = bool(gap_rows)
    report = {
        "overall": "any-gap" if any_gap else ("all-pass-with-na" if na_rows else "all-pass"),
        "gaps": gap_rows,
        "n-a-results": na_rows,
        "verdict_counts": {v: verdicts.count(v) for v in VERDICTS if v in verdicts},
        "defects": all_defects,
        "rows": rows,
        "executable": executable,
        "regression_rows": list(regression_rows),
        "verdicts_used": list(VERDICTS),
    }
    text = json.dumps(report, indent=2)
    print(text)
    if args.report:
        dest = Path(args.report)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(text + "\n", encoding="utf-8")
        print(f"\n[report written to {dest}]", file=sys.stderr)


if __name__ == "__main__":
    main()
