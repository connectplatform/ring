#!/usr/bin/env bash
# Install a git alias so `git push-layer1` runs push + forge CI.
# (Git has no built-in post-push hook; alias is the supported pattern.)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

git config alias.push-layer1 "!bash \"${ROOT}/scripts/ci/push-layer1.sh\""
echo "Installed: git push-layer1  →  bash scripts/ci/push-layer1.sh"
echo "Also:      npm run push:layer1"
echo "Dry-run:   RING_CI_DRY_RUN=1 npm run push:layer1"
echo
echo "SSOT: origin must be https://forge.ringdom.org/ringdom/ring.git"
git remote -v | head -6
