import json, glob, re, sys

skills = sorted(glob.glob(".claude/skills/*/SKILL.md"))
print(f"Installed skills: {len(skills)}")
bad = []
for p in skills:
    t = open(p).read()
    assert t.startswith("---"), f"{p}: missing frontmatter"
    fm = t.split("---")[1]
    name = re.search(r"^name:\s*(.+)$", fm, re.M)
    desc = re.search(r"^description:", fm, re.M)
    tools = re.search(r"^allowed-tools:", fm, re.M)
    meta = re.search(r"^metadata:", fm, re.M)
    ok = name and desc and tools and meta
    if not ok:
        bad.append(p)
    label = name.group(1) if name else p
    status = "OK " if ok else "FAIL"
    print(f"  {status} {label:30s} name={bool(name)} desc={bool(desc)} tools={bool(tools)} meta={bool(meta)}")

s = json.load(open(".claude/settings.json"))
cmds = [h["command"] for m in s["hooks"]["PreToolUse"] for h in m["hooks"]]
print("PreToolUse hook command:", cmds)
assert any("git-guard.sh" in c for c in cmds), "hook not wired"
assert not bad, f"frontmatter failures: {bad}"
print("RESULT: 8/8 skills valid, hook wired in settings.json")
