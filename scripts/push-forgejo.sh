#!/usr/bin/env bash
# Push Layer1 tip to Forgejo origin (forge.ringdom.org/ringdom/ring).
# Runs compose-shadow-report first. Does NOT strip .forgejo (GitHub-only).
# Does NOT build/deploy — that is npm run push:layer1 (org CI after git push).
#
# Usage (from ring/):
#   bash scripts/push-forgejo.sh
#   bash scripts/push-forgejo.sh --dry-run
#   RING_COMPOSE_SHADOW_OK=1 bash scripts/push-forgejo.sh
#
# GitHub OSS (no .forgejo): bash scripts/push-github-oss.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
DRY=0
REMOTE="${RING_FORGE_REMOTE:-origin}"
REF="${RING_FORGE_REF:-}"

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY=1 ;;
    *)
      echo "Unknown arg: $arg" >&2
      echo "Usage: bash scripts/push-forgejo.sh [--dry-run]" >&2
      exit 3
      ;;
  esac
done

command -v git >/dev/null
git rev-parse --verify HEAD >/dev/null
ORIGIN_URL="$(git remote get-url "$REMOTE" 2>/dev/null || true)"
case "$ORIGIN_URL" in
  *forge.ringdom.org*ringdom/ring*|*forge.ringdom.org*/ringdom/ring*)
    ;;
  *)
    echo "FATAL: remote '${REMOTE}' is not forge ringdom/ring (got: ${ORIGIN_URL:-none})" >&2
    echo "Expected: https://forge.ringdom.org/ringdom/ring.git" >&2
    exit 1
    ;;
esac

if [[ -x "$ROOT/scripts/check-no-org-leak.sh" ]]; then
  echo "[push-forgejo] check-no-org-leak…"
  bash "$ROOT/scripts/check-no-org-leak.sh"
fi

echo "[push-forgejo] compose-shadow-report (base=origin/main, head=worktree)…"
bash "$ROOT/scripts/run-compose-shadow-report.sh" --base origin/main

if [[ "$DRY" -eq 1 ]]; then
  if [[ -n "$REF" ]]; then
    echo "DRY-RUN: would git push ${REMOTE} ${REF}"
  else
    echo "DRY-RUN: would git push ${REMOTE}"
  fi
  exit 0
fi

if [[ -n "$REF" ]]; then
  echo "[push-forgejo] git push ${REMOTE} ${REF}"
  git push "$REMOTE" "$REF"
else
  echo "[push-forgejo] git push ${REMOTE}"
  git push "$REMOTE"
fi
echo "[push-forgejo] Forgejo tip pushed. Prod roll: cd web && npm run push:layer1 (or ci:layer1 if already on origin)."
