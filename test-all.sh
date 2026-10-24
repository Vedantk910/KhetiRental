#!/usr/bin/env bash
# Runs every unit + integration suite in the repo. Integration tests need
# Redis on REDIS_TEST_ADDR (default 127.0.0.1:6390) and Postgres on
# PGHOST:PGPORT (default 127.0.0.1:5440); they SKIP when those are absent.
# The k6 load test is separate: see showcase/tests/load/k6/full_flow.js.
# apps/web needs `npm ci` first, and Postgres + PostGIS on WEB_DATABASE_URL (default the dev database,
# postgres://kheti:kheti@localhost:5432/kheti). Its tests clone throwaway databases from template_postgis
# and the e2e run builds its own kheti_e2e; the dev database's data is never read or written. Agent-tooling checks: scripts/check-agent-tooling.sh.
set -uo pipefail
cd "$(dirname "$0")"
failed=()
run() {
  echo "== $1"
  if (eval "$2"); then echo "   PASS $1"; else echo "   FAIL $1"; failed+=("$1"); fi
}

# Product: the website.
export WEB_DATABASE_URL="${WEB_DATABASE_URL:-postgres://kheti:kheti@localhost:5432/kheti}"
run "web" "cd apps/web && test -d node_modules && export DATABASE_URL=\"\$WEB_DATABASE_URL\" && npm run -s lint && npm run -s format:check && npm run -s typecheck && npm test --silent && npm run -s build >/dev/null && npm run -s test:e2e"

# Showcase: the engineering portfolio (Go services, contracts, analytics, SQL).
for s in matching-engine booking-orchestrator telemetry-gateway; do
  run "showcase go $s" "cd showcase/go/$s && test -z \"\$(gofmt -l .)\" && go vet ./... && go test -race -count=1 ./..."
done
run "showcase analytics" "python3 -m unittest discover -s showcase/analytics"
# CLIs write showcase/analytics/results/; run them on a temp copy so tracked reports stay untouched.
run "showcase pricing+kpi CLIs" "t=\$(mktemp -d) && cp showcase/analytics/*.py \"\$t\" && python3 \"\$t/pricing.py\" >/dev/null && python3 \"\$t/kpis.py\" >/dev/null; rc=\$?; rm -rf \"\$t\"; exit \$rc"
run "showcase sql migrations" "showcase/deploy/sql/test_migrations.sh"
run "showcase k6 script parses" "! command -v k6 >/dev/null || k6 inspect showcase/tests/load/k6/full_flow.js >/dev/null"

# Repo checks.
run "docs" "python3 docs/check_docs.py"
run "workflows" "python3 .github/test_workflows.py"
run "git-guard" "for c in 'git push --force' 'git reset --hard' 'git clean -fd' 'git branch -D x'; do echo \"{\\\"tool_input\\\":{\\\"command\\\":\\\"\$c\\\"}}\" | .claude/hooks/git-guard.sh 2>/dev/null && exit 1; done; echo '{\"tool_input\":{\"command\":\"git status\"}}' | .claude/hooks/git-guard.sh"

echo
if [ ${#failed[@]} -eq 0 ]; then echo "ALL PASS"; else echo "FAILED: ${failed[*]}"; exit 1; fi
