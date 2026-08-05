#!/usr/bin/env bash
# Layer1 CI — build → Forgejo OCI publish → k3s-or prod pod update
#
# SSOT:
#   Git Layer1:  forge.ringdom.org/ringdom/ring.git  (local checkout: ring-platform.org)
#   OCI image:   registry.ringdom.org/ringdom-clones/ring:v*-ring-platform-org-amd64
#   Builder:     k3s-3 BuildKit (native amd64) — not Colima/QEMU
#   Prod:        k3s-or namespace ring-platform-org
#
# Usage:
#   npm run ci:layer1
#   bash scripts/ci/layer1-forge-build-deploy.sh --dry-run
#   bash scripts/ci/layer1-forge-build-deploy.sh --skip-deploy
#   bash scripts/ci/layer1-forge-build-deploy.sh --from-forge
#   bash scripts/ci/push-layer1.sh          # git push origin + CI
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

K3S3_KUBECONFIG="${RING_K3S3_KUBECONFIG:-${HOME}/.kube/clusters/k3s-3.yaml}"
K3S_OR_KUBECONFIG="${RING_K3S_OR_KUBECONFIG:-${HOME}/.kube/clusters/k3s-or.yaml}"
BUILD_HOST="${RING_FORGE_BUILD_SSH:-k3s-3}"
BUILDKIT_NS="${RING_BUILDKIT_NS:-buildkit}"
HOST_CTX="${RING_FORGE_HOST_CTX:-/var/tmp/ring-platform-build}"
POD_CTX="${RING_FORGE_POD_CTX:-/tmp/ring-ctx}"
LOG_REMOTE="${RING_FORGE_BUILD_LOG:-/var/tmp/ring-forge-buildctl.log}"
SCRIPT_REMOTE="${RING_FORGE_BUILD_SCRIPT:-/var/tmp/ring-forge-buildctl.sh}"
PLATFORM_GIT="${RING_PLATFORM_GIT_URL:-https://forge.ringdom.org/ringdom/ring.git}"
REGISTRY="${RING_DOCKER_REGISTRY:-registry.ringdom.org}"
NAMESPACE_OCI="${RING_DOCKER_NAMESPACE:-ringdom-clones}"
IMAGE_NAME="${RING_DOCKER_IMAGE:-ring}"
K8S_NS="${RING_K8S_NAMESPACE:-ring-platform-org}"
K8S_DEPLOY="${RING_K8S_DEPLOYMENT:-ring-platform-org}"
K8S_CONTAINER="${RING_K8S_CONTAINER:-ring-platform-org}"

DRY_RUN=0
SKIP_BUILD=0
SKIP_DEPLOY=0
FROM_FORGE=0
VERSION_OVERRIDE=""

usage() {
  sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    --skip-deploy) SKIP_DEPLOY=1 ;;
    --from-forge) FROM_FORGE=1 ;;
    --local-context) FROM_FORGE=0 ;;
    --version)
      VERSION_OVERRIDE="${2:-}"
      shift
      ;;
    -h|--help) usage ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
  shift
done

PKG_VERSION="$(jq -r .version package.json)"
VERSION="${VERSION_OVERRIDE:-$PKG_VERSION}"
VERSION="${VERSION#v}"
TAG="v${VERSION}-ring-platform-org-amd64"
IMAGE="${REGISTRY}/${NAMESPACE_OCI}/${IMAGE_NAME}:${TAG}"

log() { printf '[layer1-ci] %s\n' "$*"; }

require_file() {
  [[ -f "$1" ]] || { echo "Missing required file: $1" >&2; exit 1; }
}

require_file "$K3S3_KUBECONFIG"
require_file "$K3S_OR_KUBECONFIG"
require_file "$ROOT/Dockerfile"

k3s3() { KUBECONFIG="$K3S3_KUBECONFIG" kubectl "$@"; }
k3sor() { KUBECONFIG="$K3S_OR_KUBECONFIG" kubectl "$@"; }

resolve_buildkit_pod() {
  local pod
  pod="$(k3s3 -n "$BUILDKIT_NS" get pods \
    -l app=buildkit \
    --field-selector=status.phase=Running \
    -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
  if [[ -z "$pod" ]]; then
    pod="$(k3s3 -n "$BUILDKIT_NS" get pods --field-selector=status.phase=Running \
      -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
  fi
  printf '%s' "$pod"
}

env_or() {
  local key="$1" default="$2"
  local env_key="RING_BUILD_ARG_${key}"
  if [[ -n "${!env_key:-}" ]]; then
    printf '%s' "${!env_key}"
  else
    printf '%s' "$default"
  fi
}

# Shell-quote a value for embedding into the remote buildctl script.
sq() { printf '%q' "$1"; }

write_remote_buildctl_script() {
  local pod="$1"
  # Public build-args only — AUTH_SECRET / DB passwords stay in K8s at runtime.
  local g_id fb_key fb_app fb_vapid wc next_url app_url api_url fb_proj fb_auth fb_bucket fb_sender fb_meas \
    db_mode db_host db_port db_name db_user poly wc_id wfp_acct wfp_dom allow_tok allow_pp
  g_id="$(env_or NEXT_PUBLIC_AUTH_GOOGLE_ID '943600517697-dcl8js3nfu0fci1grkrvi9kqraduvgf4.apps.googleusercontent.com')"
  fb_key="$(env_or NEXT_PUBLIC_FIREBASE_API_KEY 'AIzaSyCJGCDpjjP4DrBulMvgQ2vkxt0PFI5dsjA')"
  fb_app="$(env_or NEXT_PUBLIC_FIREBASE_APP_ID '1:943600517697:web:6def92b494dd06f601bcc0')"
  # FCM Web Push certificate — Console cert for ring-platform (BMQk…). Never hardcode stale BDk39/BKQ4.
  fb_vapid="$(env_or NEXT_PUBLIC_FIREBASE_VAPID_KEY '')"
  if [[ -z "$fb_vapid" ]]; then
    local secrets_json="${RING_SECRETS_JSON:-$ROOT/../AI-SECRETS/ring-platform.org/ring-platform.org-secrets.json}"
    if [[ -f "$secrets_json" ]] && command -v jq >/dev/null 2>&1; then
      fb_vapid="$(jq -r '.build_args.NEXT_PUBLIC_FIREBASE_VAPID_KEY // empty' "$secrets_json")"
    fi
  fi
  if [[ -z "$fb_vapid" ]]; then
    echo "FATAL: NEXT_PUBLIC_FIREBASE_VAPID_KEY required (export env, RING_BUILD_ARG_NEXT_PUBLIC_FIREBASE_VAPID_KEY, or AI-SECRETS build_args)." >&2
    exit 1
  fi
  wc="$(env_or NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID '03531d834dcd14038f2a7d78576e0d41')"
  next_url="$(env_or NEXTAUTH_URL 'https://ring-platform.org')"
  app_url="$(env_or NEXT_PUBLIC_APP_URL 'https://ring-platform.org')"
  api_url="$(env_or NEXT_PUBLIC_API_URL 'https://ring-platform.org')"
  fb_proj="$(env_or NEXT_PUBLIC_FIREBASE_PROJECT_ID 'ring-platform')"
  fb_auth="$(env_or NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN 'ring-platform.firebaseapp.com')"
  fb_bucket="$(env_or NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET 'ring-platform.firebasestorage.app')"
  fb_sender="$(env_or NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID '943600517697')"
  fb_meas="$(env_or NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID 'G-P88CYTGMSC')"
  db_mode="$(env_or DB_BACKEND_MODE 'k8s-postgres-fcm')"
  db_host="$(env_or DB_HOST 'postgres.ring-platform-org.svc.cluster.local')"
  db_port="$(env_or DB_PORT '5432')"
  db_name="$(env_or DB_NAME 'ring_platform')"
  db_user="$(env_or DB_USER 'ring_user')"
  poly="$(env_or POLYGON_RPC_URL 'https://polygon-rpc.com')"
  wfp_acct="$(env_or WAYFORPAY_MERCHANT_ACCOUNT '')"
  wfp_dom="$(env_or WAYFORPAY_DOMAIN '')"
  allow_tok="$(env_or NEXT_PUBLIC_PAYMENT_STORE_ALLOW_TOKEN 'false')"
  allow_pp="$(env_or NEXT_PUBLIC_PAYMENT_STORE_ALLOW_PAYPAL 'false')"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "DRY-RUN: write ${SCRIPT_REMOTE} for pod=${pod} image=${IMAGE}"
    return
  fi

  ssh "$BUILD_HOST" "cat > '${SCRIPT_REMOTE}'" <<EOF
#!/usr/bin/env bash
set -euo pipefail
POD=$(sq "$pod")
IMAGE=$(sq "$IMAGE")
LOG=$(sq "$LOG_REMOTE")
POD_CTX=$(sq "$POD_CTX")
echo "=== START \$(date -u +%Y-%m-%dT%H:%M:%SZ) IMAGE=\$IMAGE ===" > "\$LOG"
kubectl -n ${BUILDKIT_NS} exec "\$POD" -- buildctl --addr unix:///run/buildkit/buildkitd.sock build \\
  --frontend dockerfile.v0 \\
  --local context=\$POD_CTX \\
  --local dockerfile=\$POD_CTX \\
  --opt platform=linux/amd64 \\
  --opt build-arg:NEXT_PUBLIC_AUTH_GOOGLE_ID=$(sq "$g_id") \\
  --opt build-arg:NEXT_PUBLIC_GOOGLE_CLIENT_ID=$(sq "$g_id") \\
  --opt build-arg:NEXTAUTH_URL=$(sq "$next_url") \\
  --opt build-arg:NEXT_PUBLIC_FIREBASE_PROJECT_ID=$(sq "$fb_proj") \\
  --opt build-arg:NEXT_PUBLIC_FIREBASE_API_KEY=$(sq "$fb_key") \\
  --opt build-arg:NEXT_PUBLIC_FIREBASE_APP_ID=$(sq "$fb_app") \\
  --opt build-arg:NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$(sq "$fb_auth") \\
  --opt build-arg:NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$(sq "$fb_bucket") \\
  --opt build-arg:NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$(sq "$fb_sender") \\
  --opt build-arg:NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=$(sq "$fb_meas") \\
  --opt build-arg:NEXT_PUBLIC_FIREBASE_VAPID_KEY=$(sq "$fb_vapid") \\
  --opt build-arg:NEXT_PUBLIC_APP_URL=$(sq "$app_url") \\
  --opt build-arg:NEXT_PUBLIC_API_URL=$(sq "$api_url") \\
  --opt build-arg:RING_BUILD_SKIP_DB=1 \\
  --opt build-arg:DB_BACKEND_MODE=$(sq "$db_mode") \\
  --opt build-arg:DB_HOST=$(sq "$db_host") \\
  --opt build-arg:DB_PORT=$(sq "$db_port") \\
  --opt build-arg:DB_NAME=$(sq "$db_name") \\
  --opt build-arg:DB_USER=$(sq "$db_user") \\
  --opt build-arg:POLYGON_RPC_URL=$(sq "$poly") \\
  --opt build-arg:NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$(sq "$wc") \\
  --opt build-arg:WAYFORPAY_MERCHANT_ACCOUNT=$(sq "$wfp_acct") \\
  --opt build-arg:WAYFORPAY_DOMAIN=$(sq "$wfp_dom") \\
  --opt build-arg:NEXT_PUBLIC_PAYMENT_STORE_ALLOW_TOKEN=$(sq "$allow_tok") \\
  --opt build-arg:NEXT_PUBLIC_PAYMENT_STORE_ALLOW_PAYPAL=$(sq "$allow_pp") \\
  --output type=image,name=\$IMAGE,push=true \\
  >>"\$LOG" 2>&1
EC=\$?
echo "=== END \$(date -u +%Y-%m-%dT%H:%M:%SZ) exit=\$EC ===" >>"\$LOG"
exit \$EC
EOF
  ssh "$BUILD_HOST" "chmod +x '${SCRIPT_REMOTE}'"
}

sync_local_context() {
  log "Rsync local Layer1 tree → ${BUILD_HOST}:${HOST_CTX}"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "DRY-RUN: rsync → ${BUILD_HOST}:${HOST_CTX}/"
    return
  fi
  ssh "$BUILD_HOST" "mkdir -p '${HOST_CTX}'"
  rsync -az --delete \
    --exclude node_modules --exclude '**/node_modules' \
    --exclude .next --exclude out --exclude build --exclude dist \
    --exclude .git --exclude coverage --exclude '*.log' --exclude log --exclude logs \
    --exclude .DS_Store --exclude solana/target --exclude '**/artifacts' \
    --exclude .swc --exclude .vercel --exclude .cursor \
    --exclude '.env' --exclude '.env.*' \
    "${ROOT}/" "${BUILD_HOST}:${HOST_CTX}/"
  ssh "$BUILD_HOST" "rm -f '${HOST_CTX}'/.env '${HOST_CTX}'/.env.local '${HOST_CTX}'/.env.* 2>/dev/null || true"
}

sync_forge_context() {
  log "Clone Layer1 on builder from ${PLATFORM_GIT}"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "DRY-RUN: forge clone into ${HOST_CTX}"
    return
  fi
  local token auth_url
  token="$(k3s3 -n "$BUILDKIT_NS" get secret forgejo-write -o jsonpath='{.data.token}' | base64 -d)"
  [[ -n "$token" ]] || { echo "forgejo-write token empty" >&2; exit 1; }
  auth_url="$(printf '%s' "$PLATFORM_GIT" | sed "s#https://#https://oauth2:${token}@#")"
  ssh "$BUILD_HOST" "rm -rf '${HOST_CTX}' && mkdir -p '${HOST_CTX}' && git clone --depth 1 '${auth_url}' '${HOST_CTX}'"
}

stream_context_to_pod() {
  local pod="$1"
  log "Stream context → pod ${pod}:${POD_CTX}"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "DRY-RUN: tar | kubectl exec … tar xf"
    return
  fi
  k3s3 -n "$BUILDKIT_NS" exec "$pod" -- rm -rf "$POD_CTX"
  k3s3 -n "$BUILDKIT_NS" exec "$pod" -- mkdir -p "$POD_CTX"
  ssh "$BUILD_HOST" "tar -C '${HOST_CTX}' -cf - ." \
    | k3s3 -n "$BUILDKIT_NS" exec -i "$pod" -- tar -C "$POD_CTX" -xf -
  k3s3 -n "$BUILDKIT_NS" exec "$pod" -- test -f "${POD_CTX}/Dockerfile"
}

run_buildctl() {
  local pod="$1"
  write_remote_buildctl_script "$pod"
  log "buildctl push ${IMAGE} (log: ssh ${BUILD_HOST} tail -f ${LOG_REMOTE})"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "DRY-RUN: ssh ${BUILD_HOST} ${SCRIPT_REMOTE}"
    return
  fi
  ssh "$BUILD_HOST" "'${SCRIPT_REMOTE}'"
}

patch_deployment_yaml() {
  local yaml="$ROOT/k8s/deployment.yaml"
  [[ -f "$yaml" ]] || return 0
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "DRY-RUN: set image in deployment.yaml → ${IMAGE}"
    return
  fi
  perl -i -pe "s#(registry\\.ringdom\\.org/ringdom-clones/ring:)\\S+#\${1}${TAG}#g" "$yaml"
  log "Updated k8s/deployment.yaml image tag → ${TAG}"
}

deploy_prod() {
  log "Roll prod on k3s-or → ${IMAGE}"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "DRY-RUN: kubectl set image + rollout status"
    return
  fi
  k3sor -n "$K8S_NS" set image "deployment/${K8S_DEPLOY}" "${K8S_CONTAINER}=${IMAGE}"
  k3sor -n "$K8S_NS" rollout status "deployment/${K8S_DEPLOY}" --timeout=15m
  k3sor -n "$K8S_NS" get deploy "$K8S_DEPLOY" \
    -o jsonpath='ready={.status.readyReplicas}/{.status.replicas} image={.spec.template.spec.containers[0].image}{"\n"}'
}

log "Layer1 CI start version=${VERSION} image=${IMAGE} from_forge=${FROM_FORGE}"

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  POD="$(resolve_buildkit_pod)"
  [[ -n "$POD" ]] || { echo "No running buildkit pod in ${BUILDKIT_NS}" >&2; exit 1; }
  log "BuildKit pod: ${POD}"

  if [[ "$FROM_FORGE" -eq 1 ]]; then
    sync_forge_context
  else
    sync_local_context
  fi
  stream_context_to_pod "$POD"
  run_buildctl "$POD"
  log "Publish OK: ${IMAGE}"
else
  log "Skip build (expect existing ${IMAGE})"
fi

patch_deployment_yaml

if [[ "$SKIP_DEPLOY" -eq 0 ]]; then
  deploy_prod
  log "Prod roll OK"
else
  log "Skip deploy"
fi

log "Layer1 CI complete → ${IMAGE}"
