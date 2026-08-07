/**
 * Ring Docker / OCI registry SSOT for CLI (mirrors lib/docker-registry.ts).
 * Forgejo on ring-mesh — not GHCR.
 */
export const RING_DOCKER_REGISTRY_DEFAULT = 'registry.ringdom.org';
export const RING_DOCKER_NAMESPACE_DEFAULT = 'ringdom-clones';
export const RING_DOCKER_IMAGE_DEFAULT = 'ring';
export const RING_FORGEJO_PULL_SECRET = 'forgejo-registry';

export function ringPlatformImageRepo() {
  const registry =
    (process.env.RING_DOCKER_REGISTRY && String(process.env.RING_DOCKER_REGISTRY).trim()) ||
    RING_DOCKER_REGISTRY_DEFAULT;
  const ns =
    (process.env.RING_DOCKER_NAMESPACE && String(process.env.RING_DOCKER_NAMESPACE).trim()) ||
    RING_DOCKER_NAMESPACE_DEFAULT;
  const image =
    (process.env.RING_DOCKER_IMAGE && String(process.env.RING_DOCKER_IMAGE).trim()) ||
    RING_DOCKER_IMAGE_DEFAULT;
  return `${registry}/${ns}/${image}`;
}

export function ringPlatformImage(tag) {
  const clean = String(tag || '')
    .replace(/^:+/, '')
    .trim() || 'latest';
  return `${ringPlatformImageRepo()}:${clean}`;
}
