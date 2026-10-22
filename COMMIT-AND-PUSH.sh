#!/usr/bin/env bash
# KhetiRental — final setup commit + push. Run in your terminal.
# Steps: stage, security scan (ABORTS on hit), commit as Vedantk910, push to main.
set -uo pipefail
cd /Users/tarun_k/Documents/ProjectKissanrental

echo "=== 1. Stage all tracked paths ==="
git add -A

echo
echo "=== 2. Security scan (names only; ABORTS commit if anything matches) ==="
HITS="$(git diff --cached --name-only | grep -iE '\.env($|\.)|\.pem$|\.key$|\.p12$|id_rsa|secret|token|credential|password|passwd' || true)"
if [ -n "$HITS" ]; then
  echo "!! Security scan flagged these filenames — aborting BEFORE commit:"
  echo "$HITS"
  echo "Review. Unstage anything that must not be committed (git restore --staged <file>), then re-run."
  exit 1
fi
echo "Clean — no secret-looking filenames staged."

echo
echo "=== 3. Confirm commit identity ==="
echo "Author will be: $(git config user.name) <$(git config user.email)>"
[ "$(git config user.name)" = "Vedantk910" ] || { echo "!! user.name is not Vedantk910 — run: git config user.name Vedantk910"; exit 1; }

echo
echo "=== 4. Commit ==="
git commit -m "chore: KhetiRental v2.0 initial setup — dual-track skills, .gitignore, safety hooks, plan docs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"

echo
echo "=== 5. Push to origin/main (first push, non-force) ==="
gh auth switch -u Vedantk910 2>/dev/null || true
git push -u origin main

echo
echo "=== 6. Verify ==="
echo "Local head:  $(git log --oneline -1)"
echo "Remote head: $(git rev-parse origin/main)"
