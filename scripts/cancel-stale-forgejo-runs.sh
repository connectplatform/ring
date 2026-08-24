#!/usr/bin/env bash
# Cancel waiting/running Forgejo Actions rebuilds so a new push replaces the
# k3s-3 queue instead of lining up behind 40-minute overlay-ci / fan-out jobs.
#
# Laptop (before git push):
#   bash scripts/cancel-stale-forgejo-runs.sh
# CI (keep the current run):
#   KEEP_RUN_ID=$GITHUB_RUN_ID KEEP_REPO=$GITHUB_REPOSITORY bash scripts/ci/cancel-stale-forgejo-runs.sh
#
# Token: RING_CI_TOKEN / RINGDOM_CI_TOKEN, or AI-SECRETS/k3s-3/forgejo-tokens.env
# Forgejo: POST /repos/{owner}/{repo}/actions/runs/{id}/cancel (2026-06 API).
set -euo pipefail

FORGE="${FORGE:-${FORGEJO_URL:-https://forge.ringdom.org}}"
FORGE="${FORGE%/}"
KEEP_RUN_ID="${KEEP_RUN_ID:-}"
KEEP_REPO="${KEEP_REPO:-}"

if [[ -z "${TOKEN:-}" ]]; then
  TOKEN="${RING_CI_TOKEN:-${RINGDOM_CI_TOKEN:-}}"
fi
if [[ -z "${TOKEN:-}" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  d="$SCRIPT_DIR"
  while [[ "$d" != "/" ]]; do
    if [[ -d "$d/ring/web" ]]; then
      # shellcheck disable=SC1091
      [[ -f "$d/AI-SECRETS/k3s-3/forgejo-tokens.env" ]] && set -a && source "$d/AI-SECRETS/k3s-3/forgejo-tokens.env" && set +a
      TOKEN="${RING_CI_TOKEN:-${RINGDOM_CI_TOKEN:-}}"
      break
    fi
    d="$(cd "$d/.." && pwd)"
  done
fi
if [[ -z "${TOKEN:-}" ]]; then
  echo "[cancel-stale] no RING_CI_TOKEN / RINGDOM_CI_TOKEN — skip (set env or AI-SECRETS/k3s-3/forgejo-tokens.env)"
  exit 0
fi

export FORGE TOKEN KEEP_RUN_ID KEEP_REPO

python3 - <<'PY'
import json, os, urllib.error, urllib.request

FORGE = os.environ["FORGE"].rstrip("/")
TOKEN = os.environ["TOKEN"]
KEEP_RUN = str(os.environ.get("KEEP_RUN_ID") or "").strip()
KEEP_REPO = str(os.environ.get("KEEP_REPO") or "").strip()

REPOS = [
    "ringdom/ring",
    "ringdom-clones/ring-platform-org",
    "ringdom-clones/ring-greenfood-live",
    "ringdom-clones/ring-n9life-com",
    "ringdom-clones/ring-vikka-ua",
]

# Gitea/Forgejo ActionRun status: 1 waiting, 2 running, 7 blocked (+ string forms).
ACTIVE_INT = {1, 2, 7}
ACTIVE_STR = {
    "waiting",
    "queued",
    "running",
    "pending",
    "requested",
    "in_progress",
    "blocked",
}


def api(method: str, path: str) -> tuple[int, bytes]:
    req = urllib.request.Request(
        f"{FORGE}/api/v1{path}",
        method=method,
        headers={
            "Authorization": f"token {TOKEN}",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as err:
        return err.code, err.read() or b""


def extract_runs(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("workflow_runs", "runs", "data"):
            val = payload.get(key)
            if isinstance(val, list):
                return val
    return []


def status_key(run) -> object:
    raw = run.get("status", run.get("Status"))
    if isinstance(raw, dict):
        return raw.get("string") or raw.get("name") or raw.get("id")
    return raw


def is_active(run) -> bool:
    raw = status_key(run)
    if isinstance(raw, int):
        return raw in ACTIVE_INT
    text = str(raw or "").strip().lower()
    if text.isdigit():
        return int(text) in ACTIVE_INT
    return text in ACTIVE_STR


def run_id(run) -> str:
    return str(run.get("id") or run.get("ID") or "").strip()


cancelled = 0
for repo in REPOS:
    code, body = api("GET", f"/repos/{repo}/actions/runs?limit=50")
    if code != 200:
        print(f"[cancel-stale] list {repo} HTTP {code}")
        continue
    try:
        payload = json.loads(body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        print(f"[cancel-stale] {repo} unreadable runs payload")
        continue
    for run in extract_runs(payload):
        rid = run_id(run)
        if not rid or not is_active(run):
            continue
        if KEEP_RUN and rid == KEEP_RUN and (not KEEP_REPO or repo == KEEP_REPO):
            continue
        ccode, _ = api("POST", f"/repos/{repo}/actions/runs/{rid}/cancel")
        print(f"[cancel-stale] {repo} run {rid} cancel HTTP {ccode}")
        if ccode in (200, 204):
            cancelled += 1

print(f"[cancel-stale] cancelled {cancelled} active run(s)")
PY
