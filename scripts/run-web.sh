#!/usr/bin/env bash
# Run Layer1 / overlay Next scripts from ring/ root (Final-Split SSOT).
#
# Usage:
#   npm run dev                          # community ring/web
#   npm run build
#   npm run dev -- ring-platform-org     # merge → org/.dev-merge (does NOT mutate Layer1 config)
#   npm run build -- ring-n9life-com     # clone overlay: ringdom-clones/ring-n9life-com/web or .dev-merge
#
# Always: npm run <script> -- <target>   (bare extra args are NOT script params)
set -euo pipefail

RING_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib-ring-paths.sh
source "$RING_ROOT/scripts/lib-ring-paths.sh"
KINGDOM="$(cd "$RING_ROOT/.." && pwd)"
WEB="$RING_ROOT/web"
CMD="${1:-dev}"
TARGET="${2:-}"

run_web() {
  local script="$1"
  test -d "$WEB" || { echo "FATAL: missing $WEB" >&2; exit 1; }
  bash "$RING_ROOT/scripts/ensure-ring-config.sh"
  npm run "$script" --prefix "$WEB"
}

if [[ -z "$TARGET" ]]; then
  run_web "$CMD"
  exit 0
fi

case "$TARGET" in
  ring|web|community|layer1)
    run_web "$CMD"
    ;;
  ring-platform-org|org|empire)
    ORG_ROOT="$(ring_clone_root "$KINGDOM" ring-platform-org)" || {
      echo "FATAL: empire overlay missing under $KINGDOM/ringdom-clones/ring-platform-org" >&2
      echo "  GitHub OSS checkouts only have ring/web — use: npm run $CMD" >&2
      exit 1
    }
    ORG_WEB="$ORG_ROOT/web"
    MERGE_OUT="${RING_ORG_MERGE_OUT:-$ORG_ROOT/.dev-merge}"
    test -d "$ORG_WEB" || {
      echo "FATAL: empire overlay missing at $ORG_WEB" >&2
      echo "  GitHub OSS checkouts only have ring/web — use: npm run $CMD" >&2
      exit 1
    }
    test -f "$ORG_WEB/ring-config.json" || {
      echo "FATAL: no org ring-config at $ORG_WEB/ring-config.json" >&2
      exit 1
    }
    # Compose merge — Layer1 committed config stays; empire brand in MERGE_OUT only
    bash "$RING_ROOT/scripts/merge-org-dev.sh"
    if [[ ! -d "$MERGE_OUT/node_modules" ]]; then
      echo "[run-web] npm install in $MERGE_OUT (first empire merge)"
      npm install --prefix "$MERGE_OUT"
    fi
    echo "[run-web] empire merge → $MERGE_OUT ($CMD)"
    npm run "$CMD" --prefix "$MERGE_OUT"
    ;;
  ring-*)
    CLONE="$(ring_clone_root "$KINGDOM" "$TARGET")" || {
      echo "FATAL: clone not found at $KINGDOM/ringdom-clones/$TARGET (kingdom layout — not in connectplatform/ring)" >&2
      exit 1
    }
    CLONE_WEB="$CLONE/web"
    # Final-Split: endemic overlay is web/. Full Next tree may be .dev-merge after merge-dev.
    if [[ -f "$CLONE_WEB/package.json" ]]; then
      echo "[run-web] clone web → $CLONE_WEB ($CMD)"
      npm run "$CMD" --prefix "$CLONE_WEB"
    elif [[ -f "$CLONE/.dev-merge/package.json" ]]; then
      echo "[run-web] clone .dev-merge → $CLONE/.dev-merge ($CMD)"
      npm run "$CMD" --prefix "$CLONE/.dev-merge"
    elif [[ -x "$CLONE/scripts/merge-dev.sh" ]]; then
      echo "[run-web] bootstrapping .dev-merge via scripts/merge-dev.sh"
      bash "$CLONE/scripts/merge-dev.sh"
      npm run "$CMD" --prefix "$CLONE/.dev-merge"
    else
      echo "FATAL: SSOT overlay needs $CLONE_WEB/package.json or scripts/merge-dev.sh" >&2
      echo "  Legacy flat trees belong in *.old — not run targets." >&2
      exit 1
    fi
    ;;
  *)
    echo "FATAL: unknown target '$TARGET'" >&2
    echo "  Use: (none)|ring|ring-platform-org|ring-<clone>" >&2
    echo "  Correct npm form: npm run $CMD -- <target>" >&2
    exit 1
    ;;
esac
