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

# Client portal: ownership follows the domain, not the folder.
P=services/client-portal
try ok      a@example.com $P/components/h3-map.tsx $P/app/architecture/h3-spatial/page.tsx $P/lib/h3-dispatch.ts
try ok      a@example.com $P/app/api/machines/near/route.ts $P/app/dossier/track-a-systems/page.tsx $P/e2e/h3-sandbox.spec.ts
try blocked b@example.com $P/components/h3-map.tsx
try ok      b@example.com $P/lib/pricing-engine.ts $P/lib/pricing-engine.test.ts $P/components/pricing-calculator.tsx
try ok      b@example.com $P/lib/escrow-machine.ts $P/components/escrow-state-machine.tsx $P/app/marketplace/search/page.tsx
try ok      b@example.com $P/app/api/bookings/route.ts $P/app/dossier/track-b-product/page.tsx $P/e2e/marketplace.spec.ts
try blocked a@example.com $P/lib/pricing-engine.ts
try ok      b@example.com $P/app/pricing/page.tsx $P/app/escrow/page.tsx
try blocked a@example.com $P/app/escrow/page.tsx
try blocked b@example.com $P/components/h3-map.tsx $P/lib/pricing-engine.ts
try ok      a@example.com $P/package.json $P/app/layout.tsx $P/components/navbar.tsx
try ok      b@example.com $P/package.json $P/app/page.tsx $P/tailwind.config.ts
try ok      a@example.com .github/workflows/deploy-portal.yml
try blocked b@example.com .github/workflows/deploy-portal.yml

[ "$fail" = 0 ] && echo "PASS commit-guard" || { echo "FAIL commit-guard"; exit 1; }
