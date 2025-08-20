#!/usr/bin/env bash
set -euo pipefail

# Non-interactive cron helper: triggers the training pipeline endpoint

BASE_URL="${RING_BASE_URL:-http://localhost:3000}"
curl -s -X POST "$BASE_URL/api/cron/train" | cat


