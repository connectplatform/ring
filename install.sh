#!/usr/bin/env bash
# Layer1 monorepo entry — Next app lives in web/ (Final-Split).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/web"
exec bash ./install.sh "$@"
