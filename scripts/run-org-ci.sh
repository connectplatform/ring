#!/usr/bin/env bash
# Thin Layer1 → empire CI bridge (Final-Split).
# Compose/deploy scripts live at ring-platform-org/scripts/ci (ORG_ROOT-aware).
# Do not vendor or symlink that tree into ring/scripts/ci.
set -euo pipefail
RING_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KINGDOM="$(cd "$RING_ROOT/.." && pwd)"
ORG_CI="$KINGDOM/ring-platform-org/scripts/ci"
SCRIPT_NAME="${1:-}"
shift || true

if [[ -z "$SCRIPT_NAME" ]]; then
  echo "Usage: run-org-ci.sh <script> [args…]" >&2
  echo "  e.g. run-org-ci.sh layer1-forge-build-deploy.sh --dry-run" >&2
  exit 1
fi

if [[ ! -d "$ORG_CI" ]]; then
  echo "FATAL: empire CI not found at $ORG_CI" >&2
  echo "  GitHub OSS checkouts of connectplatform/ring do not include forge compose." >&2
  echo "  Kingdom layout requires sibling ring-platform-org/scripts/ci." >&2
  exit 1
fi

TARGET="$ORG_CI/$SCRIPT_NAME"
if [[ ! -f "$TARGET" ]]; then
  echo "FATAL: missing $TARGET" >&2
  exit 1
fi

exec bash "$TARGET" "$@"
