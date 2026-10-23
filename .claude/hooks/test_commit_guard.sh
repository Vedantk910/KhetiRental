#!/usr/bin/env bash
# Integration test for commit-guard.sh: runs real `git commit`s in a throwaway
# repo with the guard installed as its pre-commit hook.
set -euo pipefail
GUARD="$(cd "$(dirname "$0")" && pwd)/commit-guard.sh"
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
cd "$T"
git init -q
git config track.a.email a@example.com
git config track.b.email b@example.com
mkdir -p .git/hooks && ln -s "$GUARD" .git/hooks/pre-commit
git -c user.name=init -c user.email=a@example.com commit -q --allow-empty --no-verify -m init

fail=0
n=0
# try <expect ok|blocked> <author email> <files...>
try() {
  local expect=$1 email=$2; shift 2
  n=$((n + 1))
  for f in "$@"; do mkdir -p "$(dirname "$f")"; echo "$n" >>"$f"; done
  git add -- "$@"
  if git -c user.name=t -c user.email="$email" commit -q -m "t$n" >/dev/null 2>&1; then got=ok; else got=blocked; fi
  git reset -q --hard HEAD 2>/dev/null; git clean -qfd
  if [ "$got" = "$expect" ]; then echo "  ok   $expect: $email $*"; else echo "  FAIL want $expect got $got: $email $*"; fail=1; fi
}

try ok      a@example.com services/matching-engine/x.go
try ok      a@example.com deploy/sql/001.sql tests/load/k6/x.js
try blocked b@example.com services/matching-engine/x.go
try ok      b@example.com contracts/openapi.yaml docs/adr/0005.md analytics/pricing.py docs/PRD.md
try blocked a@example.com contracts/openapi.yaml
try blocked a@example.com services/x.go contracts/openapi.yaml
try ok      a@example.com README.md .claude/x.md
try ok      b@example.com ARCHITECTURE.md
try blocked z@example.com services/x.go
try ok      a@example.com services/x.go README.md

[ "$fail" = 0 ] && echo "PASS commit-guard" || { echo "FAIL commit-guard"; exit 1; }
