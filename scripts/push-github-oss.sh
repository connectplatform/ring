#!/usr/bin/env bash
# Push Layer1 tip to public GitHub WITHOUT forge-only paths (.forgejo/).
#
# Model: forge origin may track repo-root .forgejo/ for Actions; GitHub must not.
# We do NOT rewrite forge history. We build one commit whose:
#   parent = github/main
#   tree   = current HEAD tree with .forgejo removed
# and push that commit to github/main (--force-with-lease).
#
# Usage (from ring/):
#   bash scripts/push-github-oss.sh
#   bash scripts/push-github-oss.sh --dry-run
#
# Forge (includes .forgejo):  git push origin main
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
DRY=0
[[ "${1:-}" == "--dry-run" ]] && DRY=1

command -v git >/dev/null
git rev-parse --verify HEAD >/dev/null
git remote get-url github >/dev/null
git remote get-url origin >/dev/null

git fetch -q github main 2>/dev/null || true
if ! git rev-parse --verify github/main >/dev/null 2>&1; then
  echo "FATAL: github/main missing — fetch github main first" >&2
  exit 1
fi

echo "[github-oss] compose-shadow-report (base=github/main, head=HEAD)…"
bash "$ROOT/scripts/run-compose-shadow-report.sh" --base github/main --head HEAD

WORK=$(mktemp -d /tmp/ring-gh-oss-XXXXXX)
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT
export GIT_INDEX_FILE="$WORK/index"

git read-tree HEAD
git rm -rf --cached --ignore-unmatch .forgejo >/dev/null 2>&1 || true
# Also strip nested DX if ever present at root (defensive)
git rm -rf --cached --ignore-unmatch .forgejo/workflows >/dev/null 2>&1 || true
TREE=$(git write-tree)
PARENT=$(git rev-parse github/main)
HEAD_TREE=$(git rev-parse "HEAD^{tree}")
STRIPPED_MSG="$(git log -1 --pretty=%s) [github-oss strip .forgejo]"

if [[ "$TREE" == "$(git rev-parse "$PARENT^{tree}")" ]]; then
  echo "GitHub already matches stripped forge tip — nothing to push."
  exit 0
fi

COMMIT=$(git commit-tree "$TREE" -p "$PARENT" -m "$STRIPPED_MSG")
echo "Prepared OSS commit $COMMIT (parent=$PARENT)"
echo "  forge HEAD tree: $HEAD_TREE"
echo "  stripped tree:   $TREE"

# Sanity: .forgejo must not appear in stripped tree
if git ls-tree -r --name-only "$TREE" | grep -q '^\.forgejo/'; then
  echo "FATAL: .forgejo still in stripped tree" >&2
  exit 1
fi

if [[ "$DRY" -eq 1 ]]; then
  echo "DRY-RUN: would push $COMMIT → github main"
  exit 0
fi

git push --force-with-lease=refs/heads/main:"$PARENT" github "$COMMIT:refs/heads/main"
echo "Pushed GitHub-OSS tip $COMMIT → github main (forge origin untouched)"
