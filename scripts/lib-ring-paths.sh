#!/usr/bin/env bash
# Kingdom / clone / L2-pack path SSOT (Final-Split).
# Source from ring/scripts and org/clone CI:
#   # shellcheck source=/dev/null
#   source "$RING_ROOT/scripts/lib-ring-paths.sh"
#
# Local layout:
#   $KINGDOM/ring/web                         Layer1
#   $KINGDOM/ring-presets/<pack>/             L2 pack (nested .git per pack)
#   $KINGDOM/ringdom-clones/ring-<slug>/      L3 clone / empire overlay
# Legacy sibling $KINGDOM/ring-<slug> still resolves if present.
# shellcheck shell=bash

ring_resolve_kingdom_from() {
  local d
  d="$(cd "$1" && pwd)"
  while [[ "$d" != "/" ]]; do
    if [[ -d "$d/ring/web" ]]; then
      printf '%s\n' "$d"
      return 0
    fi
    d="$(cd "$d/.." && pwd)"
  done
  return 1
}

# KINGDOM for clone/org scripts: climb to ring/web; CI may not have a kingdom tree.
ring_kingdom_or_parent() {
  local start="$1"
  local k
  if k="$(ring_resolve_kingdom_from "$start")"; then
    printf '%s\n' "$k"
    return 0
  fi
  printf '%s\n' "$(cd "$start/.." && pwd)"
}

ring_clone_root() {
  local kingdom="$1" slug="$2"
  if [[ -n "${RING_CLONES_ROOT:-}" && -d "$RING_CLONES_ROOT/$slug" ]]; then
    printf '%s\n' "$RING_CLONES_ROOT/$slug"
    return 0
  fi
  if [[ -d "$kingdom/ringdom-clones/$slug" ]]; then
    printf '%s\n' "$kingdom/ringdom-clones/$slug"
    return 0
  fi
  if [[ -d "$kingdom/$slug" ]]; then
    printf '%s\n' "$kingdom/$slug"
    return 0
  fi
  return 1
}

ring_presets_forge_url() {
  local pack="${1:?pack id required}"
  printf 'https://forge.ringdom.org/ring-presets/%s.git\n' "$pack"
}

# Content stamp for package.json + lockfile (reinstall when this changes).
ring_npm_tree_sig() {
  local dir="$1"
  local files=()
  [[ -f "$dir/package.json" ]] && files+=("$dir/package.json")
  [[ -f "$dir/package-lock.json" ]] && files+=("$dir/package-lock.json")
  if [[ ${#files[@]} -eq 0 ]]; then
    printf '\n'
    return 1
  fi
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "${files[@]}" | sha256sum | awk '{print $1}'
  else
    shasum -a 256 "${files[@]}" | shasum -a 256 | awk '{print $1}'
  fi
}

# npm install in a composed .dev-merge only when node_modules is missing or
# package.json / package-lock.json content changed since the last install.
ring_ensure_dev_merge_node_modules() {
  local out="$1"
  local want have
  want="$(ring_npm_tree_sig "$out" || true)"
  have="$(cat "$out/.merge-npm-sig" 2>/dev/null || true)"
  if [[ ! -d "$out/node_modules" || -z "$want" || "$want" != "$have" ]]; then
    echo "[run-web] npm install in $out (missing node_modules or package.json/lock changed)"
    npm install --prefix "$out"
    printf '%s\n' "$want" >"$out/.merge-npm-sig"
  fi
}

# After overlay rsync, fail if any overlay file would still transfer (dest did not win).
ring_assert_overlay_applied() {
  local overlay="$1"
  local out="$2"
  local leftover
  leftover="$(rsync -ainc --safe-links \
    --exclude node_modules --exclude .next --exclude .git \
    --exclude '.merge-npm-sig' \
    "$overlay/" "$out/" | grep -vE '/$' | grep -v '^$' || true)"
  if [[ -n "$leftover" ]]; then
    echo "FATAL: overlay did not fully apply onto $out:" >&2
    echo "$leftover" >&2
    return 1
  fi
  if [[ -f "$overlay/ring-config.json" ]] && ! cmp -s "$overlay/ring-config.json" "$out/ring-config.json"; then
    echo "FATAL: overlay ring-config.json did not overwrite $out/ring-config.json" >&2
    return 1
  fi
}

# Itemized content diffs of SRC onto DEST (checksum). Skips dirs, env, and
# paths that exist as files under SKIP_DIR (L3 overlay wins — those pack files
# always re-copy after L1 stomps dest; they are not real L2 edits).
ring_compose_pending_files() {
  local src="$1"
  local dest="$2"
  local skip_dir="${3:-}"
  local line code relpath
  [[ -d "$src" && -d "$dest" ]] || return 0
  rsync -ainc --checksum --safe-links \
    --exclude node_modules --exclude .next --exclude .git \
    --exclude '.merge-npm-sig' --exclude '.DS_Store' \
    --exclude '.env' --exclude '.env.*' \
    --exclude '*.tsbuildinfo' \
    "$src/" "$dest/" | while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    code="${line%% *}"
    relpath="${line#* }"
    [[ "$relpath" == "$code" ]] && continue
    [[ "$relpath" == */ ]] && continue
    case "$code" in
      '>'*|'*'* ) ;;
      *) continue ;;
    esac
    if [[ -n "$skip_dir" && -e "$skip_dir/$relpath" ]]; then
      continue
    fi
    if [[ "$code" == *deleting* ]]; then
      printf '  - %s\n' "$relpath"
    elif [[ "$code" == '>f+++++++++'* || "$code" == '>f+++++++'* ]]; then
      printf '  + %s\n' "$relpath"
    else
      printf '  ~ %s\n' "$relpath"
    fi
  done
}

ring_compose_print_layer_pending() {
  local label="$1"
  local src="$2"
  local dest="$3"
  local skip_dir="${4:-}"
  local lines
  if [[ "${RING_COMPOSE_QUIET:-}" == "1" ]]; then
    return 0
  fi
  lines="$(ring_compose_pending_files "$src" "$dest" "$skip_dir" || true)"
  if [[ -n "$lines" ]]; then
    echo "[compose] $label"
    printf '%s\n' "$lines"
  else
    echo "[compose] $label: unchanged"
  fi
}

# Incremental L1 → optional L2 pack → L3 overlay compose into OUT.
# Direction: SOURCE/ → DEST/ (trailing slashes = copy contents into dest).
# Later rsync wins: L1, then pack, then overlay. --checksum so a newer dest
# with the same size cannot block source (GNU rsync -a skips on size+mtime).
# L1 --delete drops files removed from Layer1; pack/overlay restore overlay-only
# paths. Nuclear wipe: RING_DEV_MERGE_WIPE=1.
#
#   ring_compose_dev_merge LAYER1 OUT OVERLAY_WEB [PACK_WEB]
ring_compose_dev_merge() {
  local layer1="$1"
  local out="$2"
  local overlay="$3"
  local pack="${4:-}"
  local pack_label overlay_label

  test -d "$layer1" || { echo "FATAL: Layer1 missing at $layer1" >&2; return 1; }
  test -d "$overlay" || { echo "FATAL: overlay missing at $overlay" >&2; return 1; }
  if [[ -n "$pack" && ! -d "$pack" ]]; then
    echo "FATAL: L2 pack missing at $pack" >&2
    return 1
  fi

  if [[ "${RING_DEV_MERGE_WIPE:-}" == "1" ]]; then
    echo "[compose] RING_DEV_MERGE_WIPE=1 — removing $out"
    rm -rf "$out"
  fi
  mkdir -p "$out"

  overlay_label="$(basename "$(dirname "$overlay")")"
  if [[ -n "$pack" ]]; then
    pack_label="$(basename "$(dirname "$pack")")"
    ring_compose_print_layer_pending "L2 ${pack_label}" "$pack" "$out" "$overlay"
  fi
  ring_compose_print_layer_pending "L3 ${overlay_label}" "$overlay" "$out"

  # Layer1 community tree — skip DX/empire link targets & secrets; KEEP ring-config (overlay wins)
  rsync -a --checksum --delete --safe-links \
    --exclude node_modules --exclude .next --exclude .git \
    --exclude '.env' --exclude '.env.*' \
    --exclude '.merge-npm-sig' \
    --exclude features/calculator \
    --exclude features/crm \
    --exclude 'app/[locale]/my-orders' \
    --exclude 'app/[locale]/my-jobs' \
    --exclude 'app/[locale]/admin/crm' \
    --exclude 'app/[locale]/calculator' \
    --exclude 'app/[locale]/deployment-calculator' \
    --exclude app/api/my-orders \
    --exclude app/api/my-jobs \
    --exclude app/api/admin/crm \
    --exclude app/api/calculator \
    --exclude app/api/cron/forgejo-robot-gc \
    --exclude app/api/cron/forgejo-token-rotate \
    --exclude lib/payments/conductor/handlers/project-order.ts \
    --exclude cli --exclude scripts --exclude k8s --exclude .forgejo \
    "$layer1/" "$out/"

  if [[ -n "$pack" ]]; then
    rsync -a --checksum --safe-links \
      --exclude node_modules --exclude .next --exclude .git \
      --exclude '.merge-npm-sig' \
      "$pack/" "$out/"
  fi

  rsync -a --checksum --safe-links \
    --exclude node_modules --exclude .next --exclude .git \
    --exclude '.merge-npm-sig' \
    "$overlay/" "$out/"

  ring_assert_overlay_applied "$overlay" "$out"

  if [[ ! -f "$out/package.json" ]] || [[ ! -f "$out/ring-config.json" ]]; then
    echo "FATAL: merge incomplete (need package.json + ring-config.json in $out)" >&2
    return 1
  fi

  local po="$out/lib/payments/conductor/handlers/project-order.ts"
  if [[ ! -f "$po" ]]; then
    mkdir -p "$(dirname "$po")"
    cat >"$po" << 'EOF'
/**
 * Community stub — project_order handlers are empire-only.
 */
import 'server-only'
export async function handleProjectOrderWayForPayWebhook(_payload: Record<string, unknown>): Promise<boolean> {
  return false
}
export async function handleProjectOrderStripeWebhook(_event: { data?: { object?: unknown } }): Promise<boolean> {
  return false
}
EOF
    echo "[compose] seeded project-order community stub"
  fi

  if [[ -L "$out/features/calculator" ]]; then
    echo "FATAL: features/calculator is still a symlink (empire DX leak)" >&2
    return 1
  fi
}
