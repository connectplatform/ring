#!/usr/bin/env bash
# Push Layer1 to forge.ringdom.org/ringdom/ring, then build→publish→prod.
#
#   npm run push:layer1
#   bash scripts/ci/push-layer1.sh
#   bash scripts/ci/push-layer1.sh origin main
#   RING_CI_SKIP_DEPLOY=1 bash scripts/ci/push-layer1.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

REMOTE="${1:-origin}"
REF="${2:-}"
CI_EXTRA=()

if [[ -n "${RING_CI_SKIP_DEPLOY:-}" ]]; then
  CI_EXTRA+=(--skip-deploy)
fi
if [[ -n "${RING_CI_FROM_FORGE:-}" ]]; then
  CI_EXTRA+=(--from-forge)
fi
if [[ -n "${RING_CI_DRY_RUN:-}" ]]; then
  CI_EXTRA+=(--dry-run)
fi

# Default remote must be Forgejo Layer1 (not GitHub).
ORIGIN_URL="$(git remote get-url "$REMOTE" 2>/dev/null || true)"
case "$ORIGIN_URL" in
  *forge.ringdom.org*ringdom/ring*|*forge.ringdom.org*/ringdom/ring*)
    ;;
  *)
    echo "[push-layer1] Refusing: remote '${REMOTE}' is not forge ringdom/ring (got: ${ORIGIN_URL:-none})" >&2
    echo "[push-layer1] Expected: https://forge.ringdom.org/ringdom/ring.git" >&2
    exit 1
    ;;
esac

if [[ -n "$REF" ]]; then
  echo "[push-layer1] git push ${REMOTE} ${REF}"
  git push "$REMOTE" "$REF"
else
  echo "[push-layer1] git push ${REMOTE}"
  git push "$REMOTE"
fi

echo "[push-layer1] Starting Layer1 forge CI…"
exec bash "${ROOT}/scripts/ci/layer1-forge-build-deploy.sh" "${CI_EXTRA[@]}"
