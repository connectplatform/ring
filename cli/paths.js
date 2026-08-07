/**
 * Final-Split path SSOT for Ring CLI.
 * cli lives at ring/cli/; Next app at ring/web/; org overlay at ../ring-platform-org/.
 */
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** ring/cli */
export const CLI_ROOT = __dirname

/** ring/ (Layer1 git root) */
export const RING_ROOT = process.env.RING_GIT_ROOT || join(CLI_ROOT, '..')

/** Kingdom workspace (parent of ring/) */
export const KINGDOM_ROOT = join(RING_ROOT, '..')

/** ring/web — Next.js app (historical PROJECT_ROOT) */
export const WEB_ROOT =
  process.env.RING_WEB_ROOT || join(RING_ROOT, 'web')

/** Alias: most commands operate on the Next tree */
export const PROJECT_ROOT = WEB_ROOT

/** Empire overlay checkout */
export const ORG_ROOT =
  process.env.RING_ORG_ROOT || join(KINGDOM_ROOT, 'ring-platform-org')

export const ORG_WEB_ROOT =
  process.env.RING_ORG_WEB_ROOT || join(ORG_ROOT, 'web')

/** k8s manifests: prefer web DX symlink, else org root */
export function resolveK8sDir() {
  const viaWeb = join(WEB_ROOT, 'k8s')
  if (existsSync(viaWeb)) return viaWeb
  return join(ORG_ROOT, 'k8s')
}

/** Layer1 compose CI script */
export function resolveLayer1CiScript() {
  const candidates = [
    join(RING_ROOT, 'scripts', 'ci', 'layer1-forge-build-deploy.sh'),
    join(ORG_ROOT, 'scripts', 'ci', 'layer1-forge-build-deploy.sh'),
    join(WEB_ROOT, 'scripts', 'ci', 'layer1-forge-build-deploy.sh'),
  ]
  return candidates.find((p) => existsSync(p)) || candidates[0]
}
