#!/usr/bin/env bash
# git pre-commit hook: dual-track ownership guard (git-guardrails-dual-track skill).
# Blocks a commit when the author's email doesn't own the staged track paths,
# or when one commit mixes Track A and Track B paths (client-portal files are
# split by domain, see track_of). Shared paths (root files,
# .claude/, .scratch/, showcase/ARCHITECTURE.md, docs/agents/) are open to both tracks.
# Track emails come from `git config track.a.email` / `track.b.email`.
# Install per clone:  ln -sf ../../.claude/hooks/commit-guard.sh .git/hooks/pre-commit
set -euo pipefail

author="$(git var GIT_AUTHOR_IDENT | sed -E 's/.*<([^>]*)>.*/\1/')"
a_email="$(git config track.a.email || true)"
b_email="$(git config track.b.email || true)"

P=apps/web
track_of() {
  case "$1" in
    # Client portal: ownership follows the domain. Track A = H3/matching,
    # systems dossier; Track B = pricing, escrow/payments, marketplace,
    # product dossier; the rest of the shell (config, layout, navbar) is shared.
    $P/components/h3-* | $P/lib/h3-* | $P/app/architecture/h3-spatial/* | \
    $P/app/api/machines/* | $P/app/dossier/track-a-* | $P/e2e/h3-*) echo A ;;
    $P/lib/pricing-* | $P/lib/escrow-* | $P/lib/marketplace-* | $P/components/pricing-* | \
    $P/components/escrow-* | $P/app/marketplace/* | $P/app/api/bookings/* | \
    $P/app/api/escrow/* | $P/app/dossier/track-b-* | $P/app/pricing/* | \
    $P/app/escrow/* | $P/e2e/marketplace* | \
    $P/e2e/pricing* | $P/e2e/escrow*) echo B ;;
    # Rebuild (REVIEW M0+): data, auth and search are Track A; booking rules,
    # payments, pricing and product copy are Track B.
    $P/server/db/* | $P/server/auth* | $P/server/machines* | $P/server/search* | \
    $P/server/notify* | $P/server/mocks/* | $P/app/api/auth/* | $P/middleware.ts) echo A ;;
    $P/server/bookings* | $P/server/payments* | $P/server/pricing* | \
    $P/app/api/payments/* | $P/messages/*) echo B ;;
    $P/*) echo shared ;;
    showcase/go/* | showcase/deploy/* | showcase/tests/load/* | \
    .github/workflows/* | compose.yaml) echo A ;;
    showcase/contracts/* | showcase/docs/PRD.md | showcase/docs/adr/* | showcase/analytics/* | \
    packages/domain/*) echo B ;;
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
[ $need_a = 1 ] && [ "$author" != "$a_email" ] && block "Track A paths (showcase/go/, showcase/deploy/, showcase/tests/load/, .github/workflows/, portal H3/systems files) must be authored by $a_email, not $author"
[ $need_b = 1 ] && [ "$author" != "$b_email" ] && block "Track B paths (showcase/contracts/, showcase/docs/PRD.md, showcase/docs/adr/, showcase/analytics/, portal pricing/escrow/marketplace files) must be authored by $b_email, not $author"
exit 0
