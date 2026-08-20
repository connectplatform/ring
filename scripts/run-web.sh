#!/usr/bin/env bash
# Run Layer1 / overlay Next scripts from ring/ root (Final-Split SSOT).
#
# Usage (from ring/ or kingdom root — kingdom package.json proxies here):
#   npm run dev                          # community ring/web
#   npm run build
#   npm run dev -- ring-platform-org     # incremental rematch → org/.dev-merge (does NOT mutate Layer1 config)
#   npm run build -- ring-n9life-com     # clone overlay: rematch .dev-merge then npm run
#   npm run dev -- ring-greenfood-live   # thin overlay → incremental rematch .dev-merge (npm install if lock changed)
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
    ring_ensure_dev_merge_node_modules "$MERGE_OUT"
    echo "[run-web] empire merge → $MERGE_OUT ($CMD)"
    npm run "$CMD" --prefix "$MERGE_OUT"
    ;;
  ring-*)
    CLONE="$(ring_clone_root "$KINGDOM" "$TARGET")" || {
      echo "FATAL: clone not found at $KINGDOM/ringdom-clones/$TARGET (kingdom layout — not in connectplatform/ring)" >&2
      exit 1
    }
    CLONE_WEB="$CLONE/web"
    MERGE_OUT="$CLONE/.dev-merge"
    # Final-Split: endemic overlay is web/. Full Next tree is .dev-merge after merge-dev.
    # Fat overlays (package.json on web/) are legacy; thin clones must not ship one.
    if [[ -f "$CLONE_WEB/package.json" ]]; then
      echo "[run-web] clone web → $CLONE_WEB ($CMD)"
      npm run "$CMD" --prefix "$CLONE_WEB"
    else
      if [[ -x "$CLONE/scripts/merge-dev.sh" ]]; then
        echo "[run-web] rematch .dev-merge (incremental; preserves node_modules/.next)"
        bash "$CLONE/scripts/merge-dev.sh"
      fi
      if [[ ! -f "$MERGE_OUT/package.json" ]]; then
        echo "FATAL: SSOT overlay needs $CLONE_WEB/package.json or scripts/merge-dev.sh" >&2
        echo "  Legacy flat trees belong in *.old — not run targets." >&2
        exit 1
      fi
      ring_ensure_dev_merge_node_modules "$MERGE_OUT"
      echo "[run-web] clone .dev-merge → $MERGE_OUT ($CMD)"
      npm run "$CMD" --prefix "$MERGE_OUT"
    fi
    ;;
  *)
    echo "FATAL: unknown target '$TARGET'" >&2
    echo "  Use: (none)|ring|ring-platform-org|ring-<clone>" >&2
    echo "  Correct npm form: npm run $CMD -- <target>" >&2
    exit 1
    ;;
esac
