/**
 * Phase 4 / 4b clone bridge — map Order Project Config → reggie_autonomous_clone customization,
 * persist Forgejo gitUrl / imageTag, and create FI-edge Jobs for scaffold + BuildKit build.
 *
 * Next.js never shells to Reggie in-process; Jobs on k3s-3 (edge fi) perform git/BuildKit work.
 */
import 'server-only'

import type { OrderProjectConfig } from '@/features/crm/orders/order-project-config'
import { ProjectDeploymentService } from '@/features/crm/lab/deployment-service'
import { ProjectOrderService } from '@/features/crm/orders/project-order-service'
import {
  createJob,
  getJob,
  upsertConfigMap,
  type K8sJobStatus,
  type RingEdgeId,
} from '@/features/crm/lab/k8s-edge-client'
import { logger } from '@/lib/logger'

export const CLONE_BRIDGE_EDGE: RingEdgeId = 'fi'
export const CLONE_BRIDGE_JOB_NAMESPACE = 'buildkit'

export type ReggieCustomizationPayload = {
  branding: {
    name?: string
    tagline?: string
    description?: string
    colors?: Record<string, string>
    logoUrl?: string
  }
  features?: Record<string, boolean>
  domain?: {
    featureId?: string
    homePreset?: string
    entitiesPreset?: string
  }
  niche?: string
}

export function projectConfigToReggieCustomization(
  config: OrderProjectConfig,
  niche?: string,
): ReggieCustomizationPayload {
  return {
    branding: {
      name: config.clone?.displayName,
      tagline: config.branding?.slogan || config.branding?.shortDescription,
      description: config.clone?.description || config.branding?.extendedDescription,
      colors: config.branding?.colors as Record<string, string> | undefined,
      logoUrl: config.branding?.logoUrl || undefined,
    },
    features: config.features,
    domain: {
      featureId: config.domainFeatureId,
      homePreset: config.home?.preset,
      entitiesPreset: config.entities?.preset,
    },
    niche: niche || undefined,
  }
}

export function forgejoGitUrlForSlug(slug: string): string {
  const clean = slug.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  return `https://forge.ringdom.org/ringdom-clones/${clean}.git`
}

export function forgejoImageTagForSlug(slug: string, tag = 'latest'): string {
  const clean = slug.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  return `registry.ringdom.org/ringdom-clones/${clean}:${tag}`
}

function sanitizeK8sName(raw: string, max = 48): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max) || 'clone'
}

/**
 * Persist planned Forgejo URLs after scaffold (optimistic) or successful autonomous_clone + git push.
 */
export async function recordCloneBridgeUrls(
  orderId: string,
  opts: { slug: string; imageTag?: string },
): Promise<void> {
  const order = await ProjectOrderService.getById(orderId)
  if (!order) throw new Error('Order not found')
  const gitUrl = forgejoGitUrlForSlug(opts.slug)
  const imageTag = opts.imageTag || forgejoImageTagForSlug(opts.slug)
  await ProjectDeploymentService.patch(orderId, {
    gitUrl,
    imageTag,
    projectName: opts.slug,
  })
  logger.info('Clone bridge URLs recorded', { orderId, gitUrl, imageTag })
}

export async function getCloneBridgePlan(orderId: string): Promise<{
  customization: ReggieCustomizationPayload
  suggestedSlug: string
  gitUrl: string
  imageTag: string
}> {
  const order = await ProjectOrderService.getById(orderId)
  if (!order) throw new Error('Order not found')
  const { OrderProjectConfigService } = await import(
    '@/features/crm/orders/order-project-config-service'
  )
  const config = await OrderProjectConfigService.get(orderId)
  const niche = order.snapshot?.inputs?.niche || order.id
  const suggestedSlug =
    config.clone?.shortName?.trim() ||
    config.domainFeatureId ||
    niche
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) ||
    orderId.slice(0, 8)
  return {
    customization: projectConfigToReggieCustomization(config, niche),
    suggestedSlug,
    gitUrl: forgejoGitUrlForSlug(suggestedSlug),
    imageTag: forgejoImageTagForSlug(suggestedSlug),
  }
}

function jobSuffix(): string {
  return Date.now().toString(36).slice(-6)
}

/** Scaffold Job: create Forgejo repo + push thin overlay from ConfigMap customization. */
export function buildScaffoldJobManifest(opts: {
  jobName: string
  slug: string
  configMapName: string
}): Record<string, unknown> {
  const { jobName, slug, configMapName } = opts
  const cloneName = slug.startsWith('ring-') ? slug : `ring-${slug}`
  return {
    apiVersion: 'batch/v1',
    kind: 'Job',
    metadata: {
      name: jobName,
      labels: {
        'app.kubernetes.io/name': 'ring-clone-scaffold',
        'app.kubernetes.io/part-of': 'ringdom',
        'ringdom.org/order-slug': sanitizeK8sName(slug, 40),
      },
    },
    spec: {
      ttlSecondsAfterFinished: 86400,
      backoffLimit: 1,
      template: {
        metadata: {
          labels: { app: 'ring-clone-scaffold' },
        },
        spec: {
          restartPolicy: 'Never',
          containers: [
            {
              name: 'scaffold',
              image: 'alpine/git:2.45.2',
              env: [
                { name: 'CLONE_SLUG', value: slug },
                { name: 'CLONE_NAME', value: cloneName },
                { name: 'FORGEJO_URL', value: 'https://forge.ringdom.org' },
                { name: 'FORGEJO_ORG', value: 'ringdom-clones' },
                {
                  name: 'FORGEJO_TOKEN',
                  valueFrom: {
                    secretKeyRef: {
                      name: 'forgejo-write',
                      key: 'token',
                      optional: false,
                    },
                  },
                },
              ],
              volumeMounts: [
                { name: 'customization', mountPath: '/customization', readOnly: true },
                { name: 'work', mountPath: '/work' },
              ],
              command: ['sh', '-c'],
              args: [
                `set -euo pipefail
apk add --no-cache curl jq ca-certificates >/dev/null
mkdir -p /work/overlay
cp /customization/customization.json /work/overlay/customization.json
# Minimal thin overlay — ring-config from branding fields
NAME=$(jq -r '.branding.name // "Clone"' /customization/customization.json)
PRESET=$(jq -r '.domain.homePreset // "platform"' /customization/customization.json)
FEATURE=$(jq -r '.domain.featureId // empty' /customization/customization.json)
cat > /work/overlay/ring-config.json <<EOF
{
  "clone": { "name": "$CLONE_NAME", "displayName": "$NAME", "shortName": "$CLONE_SLUG" },
  "home": { "preset": "$PRESET" },
  "seo": { "siteName": "$NAME" }
}
EOF
if [ -n "$FEATURE" ] && [ "$FEATURE" != "null" ]; then
  jq --arg f "$FEATURE" '. + {($f): {enabled: true}}' /work/overlay/ring-config.json > /work/overlay/ring-config.tmp
  mv /work/overlay/ring-config.tmp /work/overlay/ring-config.json
fi
cat > /work/overlay/.reggie-propagate-exclude.json <<'EOF'
{"description":"Thin scaffold overlay","files":["ring-config.json",".reggie-propagate-exclude.json"],"directories":[],"locale_strategy":"new_keys_only"}
EOF
# Create Forgejo repo (ignore 409)
curl -sS -X POST -H "Authorization: token $FORGEJO_TOKEN" -H "Content-Type: application/json" \\
  -d "{\\"name\\":\\"$CLONE_SLUG\\",\\"private\\":true,\\"auto_init\\":false}" \\
  "$FORGEJO_URL/api/v1/orgs/$FORGEJO_ORG/repos" >/tmp/create.json || true
cd /work/overlay
git init -b main
git config user.email "order-lab@ringdom.org"
git config user.name "Ring Order Lab"
git add -A
git commit -m "scaffold: thin overlay for $CLONE_NAME"
git remote add origin "https://oauth2:\${FORGEJO_TOKEN}@forge.ringdom.org/\${FORGEJO_ORG}/\${CLONE_SLUG}.git"
git push -u origin main --force
echo "PUSHED forge.ringdom.org/$FORGEJO_ORG/$CLONE_SLUG"
`,
              ],
            },
          ],
          volumes: [
            {
              name: 'customization',
              configMap: { name: configMapName },
            },
            { name: 'work', emptyDir: {} },
          ],
        },
      },
    },
  }
}

/** Default Forgejo Layer1 platform git (repo name `ring`, not ring-platform.org). */
export const DEFAULT_PLATFORM_GIT_URL = 'https://forge.ringdom.org/ringdom/ring.git'

export function resolvePlatformGitUrl(): string {
  const fromEnv = process.env.RING_PLATFORM_GIT_URL?.trim()
  return fromEnv || DEFAULT_PLATFORM_GIT_URL
}

/**
 * BuildKit Job: shallow-clone platform (`ring`) + overlay, merge (overlay wins),
 * buildctl push. Mirrors ringdom-clone-build skip/overwrite on clean git trees.
 * Requires Secret buildkit/forgejo-write (token) for private git reads.
 */
export function buildBuildkitJobManifest(opts: {
  jobName: string
  slug: string
  gitUrl: string
  imageTag: string
  platformGitUrl?: string
}): Record<string, unknown> {
  const {
    jobName,
    slug,
    gitUrl,
    imageTag,
    platformGitUrl = resolvePlatformGitUrl(),
  } = opts
  // Job mounts forgejo-registry dockerconfig; clones via FORGEJO_TOKEN (required).
  return {
    apiVersion: 'batch/v1',
    kind: 'Job',
    metadata: {
      name: jobName,
      labels: {
        'app.kubernetes.io/name': 'ring-clone-buildkit',
        'app.kubernetes.io/part-of': 'ringdom',
        'ringdom.org/order-slug': sanitizeK8sName(slug, 40),
      },
    },
    spec: {
      ttlSecondsAfterFinished: 86400,
      backoffLimit: 1,
      template: {
        metadata: { labels: { app: 'ring-clone-buildkit' } },
        spec: {
          restartPolicy: 'Never',
          initContainers: [
            {
              name: 'copy-buildctl',
              image: 'moby/buildkit:v0.21.1',
              command: ['cp', '/usr/bin/buildctl', '/out/buildctl'],
              volumeMounts: [{ name: 'bin', mountPath: '/out' }],
            },
          ],
          containers: [
            {
              name: 'buildctl',
              image: 'alpine/git:2.45.2',
              env: [
                { name: 'BUILDKIT_HOST', value: 'tcp://buildkit.buildkit.svc.cluster.local:1234' },
                { name: 'IMAGE', value: imageTag },
                { name: 'OVERLAY_GIT_URL', value: gitUrl },
                { name: 'PLATFORM_GIT_URL', value: platformGitUrl },
                {
                  name: 'FORGEJO_TOKEN',
                  valueFrom: {
                    secretKeyRef: {
                      name: 'forgejo-write',
                      key: 'token',
                      optional: false,
                    },
                  },
                },
              ],
              resources: {
                requests: { cpu: '500m', memory: '1Gi' },
                limits: { cpu: '2', memory: '4Gi' },
              },
              volumeMounts: [
                { name: 'bin', mountPath: '/opt/bin' },
                {
                  name: 'docker-config',
                  mountPath: '/root/.docker',
                  readOnly: true,
                },
                { name: 'workspace', mountPath: '/workspace' },
              ],
              command: ['sh', '-c'],
              args: [
                `set -euo pipefail
apk add --no-cache libc6-compat ca-certificates curl tar >/dev/null
: "\${FORGEJO_TOKEN:?forgejo-write token required}"
# Inject Forgejo oauth2 only for forge.ringdom.org — never for GitHub/other remotes
auth_url() {
  case "$1" in
    https://forge.ringdom.org/*)
      echo "$1" | sed "s#https://#https://oauth2:\${FORGEJO_TOKEN}@#"
      ;;
    *)
      echo "$1"
      ;;
  esac
}
echo "Cloning platform SSOT..."
git clone --depth 1 "$(auth_url "$PLATFORM_GIT_URL")" /workspace/platform
if [ ! -f /workspace/platform/Dockerfile ]; then
  echo "FATAL: platform git missing Dockerfile — push Layer1 to ringdom/ring first (repo empty or incomplete)" >&2
  ls -la /workspace/platform >&2 || true
  exit 1
fi
echo "Cloning overlay..."
git clone --depth 1 "$(auth_url "$OVERLAY_GIT_URL")" /workspace/overlay
# Merge: overlay overwrites platform (mirror clone-build.js; skip .git)
echo "Merging overlay over platform..."
tar -C /workspace/overlay --exclude=.git -cf - . | tar -C /workspace/platform -xf -
if [ ! -f /workspace/platform/Dockerfile ]; then
  echo "FATAL: merged tree missing Dockerfile after overlay merge" >&2
  exit 1
fi
echo "Building merged tree..."
/opt/bin/buildctl --addr "$BUILDKIT_HOST" build \\
  --frontend dockerfile.v0 \\
  --local context=/workspace/platform \\
  --local dockerfile=/workspace/platform \\
  --output type=image,name="\${IMAGE}",push=true
echo "PUSHED \${IMAGE}"
`,
              ],
            },
          ],
          volumes: [
            { name: 'bin', emptyDir: {} },
            {
              name: 'docker-config',
              secret: {
                secretName: 'forgejo-registry',
                items: [{ key: '.dockerconfigjson', path: 'config.json' }],
              },
            },
            {
              name: 'workspace',
              emptyDir: { sizeLimit: '12Gi' },
            },
          ],
        },
      },
    },
  }
}

export type CloneBridgeRunResult = {
  plan: Awaited<ReturnType<typeof getCloneBridgePlan>>
  jobName: string
  jobNamespace: string
  edge: RingEdgeId
  action: 'scaffold' | 'build'
}

/**
 * Phase 4b: record URLs + create scaffold Job on FI/buildkit.
 * Requires Secret buildkit/forgejo-write (token) and forgejo-registry for builds.
 */
export async function runCloneBridgeScaffold(orderId: string): Promise<CloneBridgeRunResult> {
  const plan = await getCloneBridgePlan(orderId)
  const slug = sanitizeK8sName(plan.suggestedSlug)
  const cmName = `clone-custom-${slug}`.slice(0, 63)
  const jobName = `clone-scaffold-${slug}-${jobSuffix()}`.slice(0, 63)

  await upsertConfigMap(CLONE_BRIDGE_EDGE, CLONE_BRIDGE_JOB_NAMESPACE, cmName, {
    'customization.json': JSON.stringify(plan.customization, null, 2),
  })

  await recordCloneBridgeUrls(orderId, { slug, imageTag: plan.imageTag })
  await ProjectDeploymentService.patch(orderId, {
    lastDeployStatus: 'pending',
    lastError: null,
  })

  const manifest = buildScaffoldJobManifest({ jobName, slug, configMapName: cmName })
  await createJob(CLONE_BRIDGE_EDGE, CLONE_BRIDGE_JOB_NAMESPACE, manifest)
  logger.info('Clone bridge scaffold Job created', { orderId, jobName, slug })

  return {
    plan: { ...plan, suggestedSlug: slug, gitUrl: forgejoGitUrlForSlug(slug) },
    jobName,
    jobNamespace: CLONE_BRIDGE_JOB_NAMESPACE,
    edge: CLONE_BRIDGE_EDGE,
    action: 'scaffold',
  }
}

/**
 * Phase 4b: create BuildKit Job — platform (`ring`) + overlay merge → imageTag.
 */
export async function runCloneBridgeBuild(orderId: string): Promise<CloneBridgeRunResult> {
  const plan = await getCloneBridgePlan(orderId)
  const dep = await ProjectDeploymentService.getOrCreate(orderId)
  const slug = sanitizeK8sName(dep.projectName || plan.suggestedSlug)
  const gitUrl = dep.gitUrl || forgejoGitUrlForSlug(slug)
  const imageTag = dep.imageTag || forgejoImageTagForSlug(slug)
  const platformGitUrl = resolvePlatformGitUrl()
  const jobName = `clone-build-${slug}-${jobSuffix()}`.slice(0, 63)

  if (!dep.gitUrl) {
    await recordCloneBridgeUrls(orderId, { slug, imageTag })
  }

  await ProjectDeploymentService.patch(orderId, {
    lastDeployStatus: 'pending',
    lastError: null,
    imageTag,
  })

  const manifest = buildBuildkitJobManifest({
    jobName,
    slug,
    gitUrl,
    imageTag,
    platformGitUrl,
  })
  await createJob(CLONE_BRIDGE_EDGE, CLONE_BRIDGE_JOB_NAMESPACE, manifest)
  logger.info('Clone bridge BuildKit Job created', {
    orderId,
    jobName,
    gitUrl,
    imageTag,
    platformGitUrl,
  })

  return {
    plan: { ...plan, suggestedSlug: slug, gitUrl, imageTag },
    jobName,
    jobNamespace: CLONE_BRIDGE_JOB_NAMESPACE,
    edge: CLONE_BRIDGE_EDGE,
    action: 'build',
  }
}

export async function getCloneBridgeJobStatus(jobName: string): Promise<K8sJobStatus | null> {
  return getJob(CLONE_BRIDGE_EDGE, CLONE_BRIDGE_JOB_NAMESPACE, jobName)
}
