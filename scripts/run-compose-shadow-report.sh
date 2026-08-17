#!/usr/bin/env bash
# Run compose-shadow-report before Layer1 git push.
# Default fails on chrome policy-violation, L2/L3 path shadows, and locale-key-gaps.
# RING_COMPOSE_SHADOW_OK=1 → fail only on chrome policy-violation (Commander still sees the report).
set -euo pipefail
RING_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$RING_ROOT/scripts/compose-shadow-report.mjs"
if [[ ! -f "$SCRIPT" ]]; then
  echo "FATAL: missing $SCRIPT" >&2
  exit 3
fi
echo "[compose-shadow] Layer1 vs L2 packs / L3 overlays (dry-run — no file copy)"
set +e
node "$SCRIPT" "$@"
rc=$?
set -e
if [[ "$rc" -eq 0 ]]; then
  echo "[compose-shadow] clean"
  exit 0
fi
if [[ "$rc" -eq 1 ]]; then
  echo "[compose-shadow] FAIL: chrome policy-violation on an L3 overlay. Delete those files; do not copy L1 chrome onto L3." >&2
  exit 1
fi
if [[ "$rc" -eq 2 ]]; then
  echo "[compose-shadow] FAIL: L2/L3 shadow or locale-key-gap. Port / delete / lift / leave on packs and clones, then re-run." >&2
  echo "[compose-shadow] To push Layer1 anyway after reviewing: RING_COMPOSE_SHADOW_OK=1" >&2
  exit 2
fi
echo "[compose-shadow] FAIL: report error (exit $rc)" >&2
exit "$rc"
