#!/usr/bin/env bash
# Optional, local only: checks for the AI-agent tooling in .claude/ and
# .scratch/, kept out of the product's CI (REVIEW D-05).
set -uo pipefail
cd "$(dirname "$0")/.."
python3 .claude/verify-skills.py &&
  .claude/hooks/test_commit_guard.sh &&
  (cd .scratch/skills-stack-e2e/flow && python3 test/run_tests.py)
