/**
 * Ring Docker / OCI registry SSOT — Forgejo on ring-mesh (not GHCR).
 *
 * Images:
 *   Platform: registry.ringdom.org/ringdom-clones/ring:<tag>
 *   Order Lab clones: registry.ringdom.org/ringdom-clones/<slug>:<tag>
 *
 * Override via env: RING_DOCKER_REGISTRY, RING_DOCKER_NAMESPACE, RING_DOCKER_IMAGE
 */
export const RING_DOCKER_REGISTRY_DEFAULT = 'registry.ringdom.org'
export const RING_DOCKER_NAMESPACE_DEFAULT = 'ringdom-clones'
export const RING_DOCKER_IMAGE_DEFAULT = 'ring'
/** K8s imagePullSecret name for Forgejo OCI (dockerconfigjson). */
export const RING_FORGEJO_PULL_SECRET = 'forgejo-registry'

export function resolveRingDockerRegistry(): string {
  return (
    process.env.RING_DOCKER_REGISTRY?.trim() ||
    RING_DOCKER_REGISTRY_DEFAULT
  )
}

export function resolveRingDockerNamespace(): string {
  return (
    process.env.RING_DOCKER_NAMESPACE?.trim() ||
    RING_DOCKER_NAMESPACE_DEFAULT
  )
}

export function resolveRingDockerImageName(): string {
  return process.env.RING_DOCKER_IMAGE?.trim() || RING_DOCKER_IMAGE_DEFAULT
}

/** Full repo path without tag: registry.ringdom.org/ringdom-clones/ring */
export function ringPlatformImageRepo(): string {
  return `${resolveRingDockerRegistry()}/${resolveRingDockerNamespace()}/${resolveRingDockerImageName()}`
}

/** Full image ref with tag. */
export function ringPlatformImage(tag: string): string {
  const clean = String(tag || '').replace(/^:+/, '').trim() || 'latest'
  return `${ringPlatformImageRepo()}:${clean}`
}

/**
 * Resolve a deployment image tag:
 * - If it already contains `/` (full ref), return as-is
 * - Else prefix with Forgejo platform repo
 */
export function resolvePlatformDeployImage(imageTag: string): string {
  const t = String(imageTag || '').trim()
  if (!t) return ringPlatformImage('latest')
  if (t.includes('/')) return t
  return ringPlatformImage(t)
}
