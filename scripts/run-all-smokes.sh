#!/usr/bin/env bash
# Smoke runner — interactive chat Type Debt + PIPELINES checklist.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PIPELINES="$ROOT/scripts/PIPELINES.md"

echo "== Ring smoke:pipelines =="
if [[ -f "$PIPELINES" ]]; then
  echo "PIPELINES checklist:"
  grep -E '^\| `chat\.' "$PIPELINES" || true
else
  echo "WARN: scripts/PIPELINES.md missing"
fi

echo ""
echo "== smoke-chat-interactive.cts =="
npx tsx "$ROOT/scripts/smoke-chat-interactive.cts"

echo ""
echo "== smoke-ring-oracle-fx.cts =="
npx tsx "$ROOT/scripts/smoke-ring-oracle-fx.cts"

echo "OK"
exit 0
