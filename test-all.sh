#!/usr/bin/env bash
# Runs every unit + integration suite in the repo. Integration tests need
# Redis on REDIS_TEST_ADDR (default 127.0.0.1:6390) and Postgres on
# PGHOST:PGPORT (default 127.0.0.1:5440); they SKIP when those are absent.
# The k6 load test is separate: see tests/load/k6/full_flow.js.
# client-portal needs `npm ci` in services/client-portal first.
set -uo pipefail
cd "$(dirname "$0")"
failed=()
run() {
  echo "== $1"
  if (eval "$2"); then echo "   PASS $1"; else echo "   FAIL $1"; failed+=("$1"); fi
}

for s in matching-engine booking-orchestrator telemetry-gateway; do
  run "go $s" "cd services/$s && test -z \"\$(gofmt -l .)\" && go vet ./... && go test -race -count=1 ./..."
done
run "analytics" "python3 -m unittest discover -s analytics"
# CLIs write analytics/results/; run them on a temp copy so tracked reports stay untouched.
run "pricing+kpi CLIs" "t=\$(mktemp -d) && cp analytics/*.py \"\$t\" && python3 \"\$t/pricing.py\" >/dev/null && python3 \"\$t/kpis.py\" >/dev/null; rc=\$?; rm -rf \"\$t\"; exit \$rc"
run "sql migrations" "deploy/sql/test_migrations.sh"
run "docs" "python3 docs/check_docs.py"
run "workflows" "python3 .github/test_workflows.py"
run "skills frontmatter" "python3 .claude/verify-skills.py"
run "commit-guard" ".claude/hooks/test_commit_guard.sh"
run "git-guard" "for c in 'git push --force' 'git reset --hard' 'git clean -fd' 'git branch -D x'; do echo \"{\\\"tool_input\\\":{\\\"command\\\":\\\"\$c\\\"}}\" | .claude/hooks/git-guard.sh 2>/dev/null && exit 1; done; echo '{\"tool_input\":{\"command\":\"git status\"}}' | .claude/hooks/git-guard.sh"
run "client-portal" "cd services/client-portal && test -d node_modules && npm run -s lint && npm test --silent && npm run -s build >/dev/null && npm run -s test:e2e"
run "k6 script parses" "! command -v k6 >/dev/null || k6 inspect tests/load/k6/full_flow.js >/dev/null"
run "skills e2e flow" "cd .scratch/skills-stack-e2e/flow && python3 test/run_tests.py"

echo
if [ ${#failed[@]} -eq 0 ]; then echo "ALL PASS"; else echo "FAILED: ${failed[*]}"; exit 1; fi
