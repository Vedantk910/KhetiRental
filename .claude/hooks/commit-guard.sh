#!/usr/bin/env bash
# git pre-commit hook: dual-track ownership guard (git-guardrails-dual-track skill).
# Blocks a commit when the author's email doesn't own the staged track paths,
# or when one commit mixes Track A and Track B paths. Shared paths (root files,
# .claude/, .scratch/, ARCHITECTURE.md, docs/agents/) are open to both tracks.
# Track emails come from `git config track.a.email` / `track.b.email`.
# Install per clone:  ln -sf ../../.claude/hooks/commit-guard.sh .git/hooks/pre-commit
set -euo pipefail

author="$(git var GIT_AUTHOR_IDENT | sed -E 's/.*<([^>]*)>.*/\1/')"
a_email="$(git config track.a.email || true)"
b_email="$(git config track.b.email || true)"

track_of() {
  case "$1" in
    services/* | deploy/* | tests/load/*) echo A ;;
    contracts/* | docs/PRD.md | docs/adr/* | analytics/*) echo B ;;
    *) echo shared ;;
  esac
}

need_a=0 need_b=0
while IFS= read -r f; do
  case "$(track_of "$f")" in
    A) need_a=1 ;;
    B) need_b=1 ;;
  esac
done < <(git diff --cached --name-only)

block() { echo "commit-guard: BLOCKED — $1" >&2; exit 1; }
[ $need_a = 1 ] && [ $need_b = 1 ] && block "commit mixes Track A and Track B paths; split it into one commit per track"
[ $need_a = 1 ] && [ "$author" != "$a_email" ] && block "Track A paths (services/, deploy/, tests/load/) must be authored by $a_email, not $author"
[ $need_b = 1 ] && [ "$author" != "$b_email" ] && block "Track B paths (contracts/, docs/PRD.md, docs/adr/, analytics/) must be authored by $b_email, not $author"
exit 0
