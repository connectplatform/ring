#!/usr/bin/env bash
# Provider SSOT gate — useUnreadCount / useCreditBalance only in owners + tests.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0

check_allowlist() {
  local pattern="$1"
  local allow_regex="$2"
  local label="$3"
  local hits
  hits="$(rg -n "$pattern" . --glob '*.{tsx,ts}' 2>/dev/null | rg -v "$allow_regex" || true)"
  if [[ -n "$hits" ]]; then
    echo "FAIL: $label"
    echo "$hits"
    fail=1
  else
    echo "OK: $label"
  fi
}

check_allowlist "useUnreadCount" 'notification-provider|use-unread-count\.ts|__tests__' 'useUnreadCount allowlist'
check_allowlist 'useCreditBalance\(' 'credit-balance-provider|use-credit-balance\.ts|__tests__' 'useCreditBalance allowlist'
check_allowlist 'useCreditHistory\(' 'credit-history-provider|use-credit-history\.ts|wallet-wrapper|__tests__' 'useCreditHistory allowlist'

exit "$fail"
