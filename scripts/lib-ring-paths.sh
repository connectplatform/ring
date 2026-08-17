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
