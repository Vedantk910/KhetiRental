#!/usr/bin/env bash
# PreToolUse hook: deterministic blocking of destructive git commands.
# Reads the PreToolUse JSON payload from stdin; exits 2 to block, 0 to allow.
# Blocks: git push --force / -f, git reset --hard, git clean -fd, git branch -D.
set -euo pipefail

input="$(cat)"

# Extract "command" field from JSON payload
cmd="$(python3 -c "
import json, sys
try:
    payload = json.load(sys.stdin)
    sys.stdout.write(payload.get('tool_input', {}).get('command', ''))
except Exception:
    pass
" <<< "$input")"

blocked_reason=""

# --- git push -f / --force ---
# Match: "git push -f" optionally followed by args; or "git push --force" optionally followed by args
# Must NOT match "git push" alone (safe), "git push origin main" (safe)
if echo "$cmd" | grep -qE 'git\s+push\s+-f(\s|$)' || \
   echo "$cmd" | grep -qE 'git\s+push\s+.*--force(\s|$)' || \
   echo "$cmd" | grep -qE 'git\s+push\s+.*\s-f(\s|$)'; then
  blocked_reason="destructive 'git push --force / -f'"

# --- git reset --hard ---
elif echo "$cmd" | grep -qE 'git\s+reset\s+--hard(\s|$)'; then
  blocked_reason="destructive 'git reset --hard'"

# --- git clean -fd / -df / -fdx / -xdf (any flag combination containing both f and d) ---
elif echo "$cmd" | grep -qE 'git\s+clean\s+-([a-zA-Z]*f[a-zA-Z]*d|[a-zA-Z]*d[a-zA-Z]*f)[a-zA-Z]*(\s|$)'; then
  blocked_reason="destructive 'git clean -fd'"

# --- git branch -D ---
elif echo "$cmd" | grep -qE 'git\s+branch\s+-[a-zA-Z]*D(\s|$)'; then
  blocked_reason="destructive 'git branch -D'"
fi

if [[ -n "$blocked_reason" ]]; then
  echo "BLOCKED: $blocked_reason. Command rejected by the repository's git safety hook." >&2
  exit 2
fi
exit 0
