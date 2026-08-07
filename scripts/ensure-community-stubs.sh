#!/usr/bin/env bash
# Restore Layer1 community stubs when empire DX links are absent.
set -euo pipefail
WEB="$(cd "$(dirname "$0")/../web" && pwd)"
PO="$WEB/lib/payments/conductor/handlers/project-order.ts"
COMM="$WEB/lib/payments/conductor/handlers/project-order.community.ts"
if [[ ! -e "$PO" || -L "$PO" && ! -e "$PO" ]]; then
  if [[ -f "$COMM" ]]; then
    rm -f "$PO"
    cp "$COMM" "$PO"
    echo "[ensure-community-stubs] restored project-order.ts"
  fi
fi
# If no DX link desired and PO is missing entirely
if [[ ! -e "$PO" && -f "$COMM" ]]; then
  cp "$COMM" "$PO"
  echo "[ensure-community-stubs] seeded project-order.ts"
fi
