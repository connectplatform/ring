#!/usr/bin/env bash
# Provider SSOT gate — useUnreadCount / useCreditBalance only in owners + tests.
#
# Extended 2026-07-07 (ring_ssot_logic_upgrade campaign): restored from HEAD
# (was deleted in an unrelated working-tree cleanup) and extended with the
# duplicate-fetch regressions fixed in that campaign — vendor status,
# SessionProvider, and the credit-balance HTTP endpoint. See
# hooks/HOOKS-README.md Provider matrix + Remediation TODOs for the full list.
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

# Counts files matching $pattern; fails if more than one file defines it.
# Use for singleton components/providers that must have exactly one SSOT
# implementation (duplicates cause the exact untuned/unmerged-settings drift
# this campaign fixed for SessionProvider).
check_single_definition() {
  local pattern="$1"
  local label="$2"
  local files
  files="$(rg -l "$pattern" . --glob '*.{tsx,ts}' 2>/dev/null || true)"
  local count=0
  if [[ -n "$files" ]]; then
    count="$(echo "$files" | wc -l | tr -d ' ')"
  fi
  if [[ "$count" -gt 1 ]]; then
    echo "FAIL: $label (found in $count files, expected 1)"
    echo "$files"
    fail=1
  else
    echo "OK: $label"
  fi
}

check_allowlist "useUnreadCount" 'notification-provider|use-unread-count\.ts|__tests__' 'useUnreadCount allowlist'
check_allowlist 'useCreditBalance\(' 'credit-balance-provider|use-credit-balance\.ts|__tests__' 'useCreditBalance allowlist'
check_allowlist 'useCreditHistory\(' 'credit-history-provider|use-credit-history\.ts|wallet-wrapper|__tests__' 'useCreditHistory allowlist'

# --- Added 2026-07-07: ring_ssot_logic_upgrade campaign ---
check_allowlist "fetch\\('/api/vendor/status'\\)" 'hooks/use-vendor-status\.ts' 'vendor status fetch allowlist (use hooks/use-vendor-status.ts)'
check_allowlist "'/api/wallet/credit/balance'" 'hooks/use-credit-balance\.ts' 'credit balance endpoint allowlist (use hooks/use-credit-balance.ts)'
check_single_definition '^export function SessionProvider' 'SessionProvider single definition'

# --- Added 2026-07-07: DB routing SSOT — rogue pg.Pool gate ---
check_db_pool_gate() {
  local hits
  hits="$(rg -n 'new Pool\(' . --glob '*.{ts,tsx,js,mjs}' 2>/dev/null | rg -v '/lib/database/' || true)"
  if [[ -n "$hits" ]]; then
    echo "FAIL: new Pool( allowed only under lib/database/"
    echo "$hits"
    fail=1
  else
    echo "OK: new Pool( confined to lib/database/"
  fi
}
check_db_pool_gate

exit "$fail"
