#!/usr/bin/env bash
# Run all Ring pipeline smoke suites against dev ring_platform.
#
# Docs: scripts/SMOKE-TESTS.md  |  Coverage: scripts/SMOKE-GAPS.md
#
# Usage:
#   ./scripts/run-all-smokes.sh
#   DB_HOST=... DB_PASSWORD=... ./scripts/run-all-smokes.sh
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export NODE_OPTIONS="--conditions=react-server"
export DB_BACKEND_MODE="${DB_BACKEND_MODE:-k8s-postgres-fcm}"
export DB_HOST="${DB_HOST:-localhost}"
export DB_PORT="${DB_PORT:-5432}"
export DB_NAME="${DB_NAME:-ring_platform}"
export DB_USER="${DB_USER:-ring_user}"
export DB_PASSWORD="${DB_PASSWORD:-ring_password_2024}"
export WAYFORPAY_SECRET_KEY="${WAYFORPAY_SECRET_KEY:-smoke_wayforpay_secret}"

SUITES=(
  "scripts/smoke-erp-referral-pipeline.cts"
  "scripts/smoke-platform-pipelines.cts"
  "scripts/smoke-commerce-pipelines.cts"
  "scripts/smoke-growth-pipelines.cts"
  "scripts/smoke-webhook-probe.cts"
  "scripts/smoke-store-checkout-pipeline.cts"
  "scripts/smoke-membership-pipeline.cts"
  "scripts/smoke-refcodes-http.cts"
  "scripts/smoke-erp-ops.cts"
  "scripts/smoke-entity-moderation-pipeline.cts"
)

failures=0
for suite in "${SUITES[@]}"; do
  echo
  echo "════════════════════════════════════════════════"
  echo "▶ $suite"
  echo "════════════════════════════════════════════════"
  if ! npx tsx "$suite"; then
    failures=$((failures + 1))
  fi
done

echo
if [[ $failures -gt 0 ]]; then
  echo "❌ $failures smoke suite(s) failed"
  exit 1
fi
echo "✅ All smoke suites passed"
