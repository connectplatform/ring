import 'server-only'

import { db, initializeDatabase } from '@/lib/database'
import {
  encryptLabSecret,
  decryptLabSecret,
  maskEnvMap,
  type MaskedEnvValue,
} from '@/features/crm/lab/lab-secret-crypto'
import { getEnvTemplateManifest, isAllowedEnvKey } from '@/features/crm/lab/env-template-parser'
import { ENV_ESSENTIALS } from '@/features/crm/lab/env-essentials'
import { isBrandMirrorEnvKey } from '@/features/crm/lab/env-key-ownership'
import {
  projectConfigToConfigMapEnv,
} from '@/features/crm/orders/order-project-config'
import {
  type RingEdgeId,
  getEdgeAvailability,
  upsertSecret,
  upsertConfigMap,
  rolloutRestart,
  setDeploymentImage,
  ensureImagePullSecrets,
  ensureForgejoRegistryPullSecret,
  ensureNamespace,
  isForgejoRegistryImage,
  listPods,
  getPodLogs,
  deletePod,
  defaultNamespaceForEdge,
  type K8sPodInfo,
} from '@/features/crm/lab/k8s-edge-client'
import { logger } from '@/lib/logger'

const COLLECTION = 'project_deployments'

export type EnvConfigEntry = {
  class: 'public' | 'secret'
  /** Plaintext for public; ciphertext for secret when encrypted=true */
  value: string
  encrypted?: boolean
}

/** Per-order Forgejo Source Editor credentials (ciphertext only at rest). */
export type SourceAuth = {
  robotUsername: string
  tokenId: number
  tokenLastEight: string
  /** encryptLabSecret(sha1) — never return via toMasked / public APIs */
  tokenEncrypted: string
  scope: 'write:repository'
  mintedAt: string
  rotatedAt?: string
  revokedAt?: string
}

export type ProjectDeployment = {
  id: string
  orderId: string
  edge: RingEdgeId
  envConfig: Record<string, EnvConfigEntry>
  projectUrl: string | null
  projectName: string | null
  imageTag: string | null
  /** Forgejo git remote after Phase 4 clone bridge */
  gitUrl: string | null
  /**
   * Per-order Forgejo robot + encrypted PAT for Order Source Editor.
   * Stripped in toMasked — never expose ciphertext/metadata on API responses.
   */
  sourceAuth?: SourceAuth | null
  namespace: string
  deploymentName: string
  secretName: string
  configMapName: string
  lastDeployAt: string | null
  lastDeployStatus: 'idle' | 'pending' | 'success' | 'failed'
  lastError: string | null
  createdAt: string
  updatedAt: string
}

function nowIso() {
  return new Date().toISOString()
}

async function probeCloneHealth(dep: ProjectDeployment): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unreachable' | 'not_deployed'
  database?: string | null
  responseMs?: number | null
  error?: string | null
}> {
  const base =
    dep.projectUrl?.replace(/\/$/, '') ||
    (() => {
      const raw = dep.envConfig.NEXT_PUBLIC_BASE_URL?.value
      if (!raw || raw.startsWith('v2:')) return null
      return raw.replace(/\/$/, '')
    })()

  if (!base) {
    return { status: 'not_deployed', database: null, responseMs: null, error: null }
  }

  const url = `${base}/api/health`
  const started = Date.now()
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    const responseMs = Date.now() - started
    const text = await res.text()
    if (!text.trim()) {
      return {
        status: res.ok ? 'degraded' : 'unhealthy',
        responseMs,
        error: 'Empty health body',
      }
    }
    let json: Record<string, unknown> = {}
    try {
      json = JSON.parse(text) as Record<string, unknown>
    } catch {
      return { status: 'degraded', responseMs, error: 'Invalid health JSON' }
    }
    const statusRaw = String(json.status || '').toLowerCase()
    const status =
      statusRaw === 'healthy' || statusRaw === 'degraded' || statusRaw === 'unhealthy'
        ? (statusRaw as 'healthy' | 'degraded' | 'unhealthy')
        : res.ok
          ? 'healthy'
          : 'unhealthy'
    const services = json.services as Record<string, unknown> | undefined
    const database =
      typeof services?.database === 'string'
        ? services.database
        : typeof json.database === 'string'
          ? json.database
          : null
    return { status, database, responseMs, error: null }
  } catch (e) {
    return {
      status: 'unreachable',
      responseMs: Date.now() - started,
      error: e instanceof Error ? e.message : 'Health probe failed',
    }
  }
}

function parseSourceAuth(raw: unknown): SourceAuth | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const tokenEncrypted = String(o.tokenEncrypted || '')
  const robotUsername = String(o.robotUsername || '')
  if (!robotUsername && !tokenEncrypted) return null
  return {
    robotUsername,
    tokenId: Number(o.tokenId || 0),
    tokenLastEight: String(o.tokenLastEight || ''),
    tokenEncrypted,
    scope: 'write:repository',
    mintedAt: String(o.mintedAt || ''),
    ...(o.rotatedAt ? { rotatedAt: String(o.rotatedAt) } : {}),
    ...(o.revokedAt ? { revokedAt: String(o.revokedAt) } : {}),
  }
}

function asDeployment(row: Record<string, unknown>): ProjectDeployment | null {
  const data = (row.data ?? row) as Record<string, unknown>
  const id = String(row.id ?? data.id ?? '')
  const orderId = String(data.orderId ?? '')
  if (!id || !orderId) return null
  return {
    id,
    orderId,
    edge: (data.edge as RingEdgeId) || 'us',
    envConfig: (data.envConfig as Record<string, EnvConfigEntry>) || {},
    projectUrl: data.projectUrl ? String(data.projectUrl) : null,
    projectName: data.projectName ? String(data.projectName) : null,
    imageTag: data.imageTag ? String(data.imageTag) : null,
    gitUrl: data.gitUrl ? String(data.gitUrl) : null,
    sourceAuth: parseSourceAuth(data.sourceAuth),
    namespace: String(data.namespace || ''),
    deploymentName: String(data.deploymentName || data.namespace || ''),
    secretName: String(data.secretName || `${data.namespace || 'app'}-secrets`),
    configMapName: String(data.configMapName || `${data.namespace || 'app'}-config`),
    lastDeployAt: data.lastDeployAt ? String(data.lastDeployAt) : null,
    lastDeployStatus: (data.lastDeployStatus as ProjectDeployment['lastDeployStatus']) || 'idle',
    lastError: data.lastError ? String(data.lastError) : null,
    createdAt: String(data.createdAt || row.created_at || nowIso()),
    updatedAt: String(data.updatedAt || row.updated_at || nowIso()),
  }
}

async function ensureDb() {
  await initializeDatabase()
}

function defaultDoc(orderId: string): Omit<ProjectDeployment, 'id'> {
  const ns = ''
  return {
    orderId,
    edge: 'us',
    envConfig: {},
    projectUrl: null,
    projectName: null,
    imageTag: null,
    gitUrl: null,
    sourceAuth: null,
    namespace: ns,
    deploymentName: ns,
    secretName: '',
    configMapName: '',
    lastDeployAt: null,
    lastDeployStatus: 'idle',
    lastError: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
}

export const ProjectDeploymentService = {
  async getByOrderId(orderId: string): Promise<ProjectDeployment | null> {
    await ensureDb()
    const result = await db().queryDocs({
      collection: COLLECTION,
      filters: [{ field: 'orderId', operator: '=', value: orderId }],
      pagination: { limit: 1 },
    })
    if (!result.success || !result.data?.length) return null
    return asDeployment(result.data[0] as Record<string, unknown>)
  },

  /**
   * Scan deployments that have sourceAuth.robotUsername set (for Forgejo robot GC).
   * Caps at 2000 rows — Order Lab scale is far below that.
   */
  async listSourceAuthRefs(): Promise<
    Array<{
      orderId: string
      robotUsername: string
      revokedAt: string | null
      mintedAt: string | null
    }>
  > {
    await ensureDb()
    const result = await db().queryDocs({
      collection: COLLECTION,
      pagination: { limit: 2000 },
    })
    if (!result.success || !result.data?.length) return []
    const out: Array<{
      orderId: string
      robotUsername: string
      revokedAt: string | null
      mintedAt: string | null
    }> = []
    for (const row of result.data) {
      const dep = asDeployment(row as Record<string, unknown>)
      const auth = dep?.sourceAuth
      if (!dep || !auth?.robotUsername) continue
      out.push({
        orderId: dep.orderId,
        robotUsername: auth.robotUsername,
        revokedAt: auth.revokedAt || null,
        mintedAt: auth.mintedAt || null,
      })
    }
    return out
  },

  async getOrCreate(orderId: string): Promise<ProjectDeployment> {
    const existing = await this.getByOrderId(orderId)
    if (existing) return existing
    await ensureDb()
    const doc = defaultDoc(orderId)
    const result = await db().createDoc(COLLECTION, doc)
    if (!result.success || !result.data) {
      throw result.error || new Error('Failed to create project_deployment')
    }
    const id = String((result.data as { id?: string }).id || '')
    return { ...doc, id }
  },

  async patch(
    orderId: string,
    patch: Partial<
      Pick<
        ProjectDeployment,
        | 'edge'
        | 'projectUrl'
        | 'projectName'
        | 'imageTag'
        | 'gitUrl'
        | 'sourceAuth'
        | 'namespace'
        | 'deploymentName'
        | 'secretName'
        | 'configMapName'
        | 'envConfig'
        | 'lastDeployAt'
        | 'lastDeployStatus'
        | 'lastError'
      >
    >,
  ): Promise<ProjectDeployment> {
    const existing = await this.getOrCreate(orderId)
    const next: ProjectDeployment = {
      ...existing,
      ...patch,
      updatedAt: nowIso(),
    }
    // Keep secret/config names in sync with namespace when namespace changes and names were empty/default
    if (patch.namespace) {
      if (!patch.secretName && (!existing.secretName || existing.secretName === `${existing.namespace}-secrets`)) {
        next.secretName = `${patch.namespace}-secrets`
      }
      if (
        !patch.configMapName &&
        (!existing.configMapName || existing.configMapName === `${existing.namespace}-config`)
      ) {
        next.configMapName = `${patch.namespace}-config`
      }
      if (!patch.deploymentName && (!existing.deploymentName || existing.deploymentName === existing.namespace)) {
        next.deploymentName = patch.namespace
      }
    }
    const { id: _id, ...data } = next
    const result = await db().updateDoc(COLLECTION, existing.id, data)
    if (!result.success) {
      throw result.error || new Error('Failed to update project_deployment')
    }
    if (
      patch.namespace !== undefined ||
      patch.deploymentName !== undefined ||
      patch.projectName !== undefined ||
      patch.edge !== undefined
    ) {
      const { syncOrderLabMetadata } = await import('@/features/crm/lab/order-lab-chat-service')
      void syncOrderLabMetadata(orderId)
    }
    return next
  },

  /**
   * Merge env patch. Secret values are encrypted at rest.
   * Empty string clears a key. Unknown keys rejected.
   */
  async saveEnvConfig(
    orderId: string,
    patch: Record<string, string | null>,
  ): Promise<ProjectDeployment> {
    const existing = await this.getOrCreate(orderId)
    const nextEnv = { ...existing.envConfig }

    for (const [key, raw] of Object.entries(patch)) {
      if (isBrandMirrorEnvKey(key)) {
        throw new Error(`Env key "${key}" is managed by Order Project Config — not writable here`)
      }
      if (!isAllowedEnvKey(key)) {
        throw new Error(`Env key "${key}" is not in env.local.template allowlist`)
      }
      if (raw === null || raw === '') {
        delete nextEnv[key]
        continue
      }
      const cls: 'public' | 'secret' = key.startsWith('NEXT_PUBLIC_') ? 'public' : 'secret'
      if (cls === 'secret') {
        nextEnv[key] = { class: 'secret', value: encryptLabSecret(raw), encrypted: true }
      } else {
        nextEnv[key] = { class: 'public', value: raw, encrypted: false }
      }
    }

    // Sync projectUrl convenience field
    const baseUrl = nextEnv.NEXT_PUBLIC_BASE_URL?.value
    return this.patch(orderId, {
      envConfig: nextEnv,
      ...(baseUrl && !baseUrl.startsWith('v2:') ? { projectUrl: baseUrl } : {}),
    })
  },

  toMasked(
    dep: ProjectDeployment,
    opts?: { hideOwnerPrivateValues?: boolean },
  ): {
    deployment: Omit<ProjectDeployment, 'envConfig' | 'sourceAuth'> & {
      envConfig: Record<string, MaskedEnvValue>
    }
    edges: Record<RingEdgeId, boolean>
    essentials: string[]
    groups: ReturnType<typeof getEnvTemplateManifest>['groups']
  } {
    const manifest = getEnvTemplateManifest()
    const { envConfig, sourceAuth: _sourceAuth, ...rest } = dep
    void _sourceAuth
    return {
      deployment: {
        ...rest,
        envConfig: maskEnvMap(envConfig, {
          hideOwnerPrivateValues: opts?.hideOwnerPrivateValues,
        }),
      },
      edges: getEdgeAvailability(),
      essentials: manifest.essentials,
      groups: manifest.groups,
    }
  },

  async applyAndDeploy(orderId: string): Promise<ProjectDeployment> {
    let dep = await this.getOrCreate(orderId)
    const namespace = dep.namespace || defaultNamespaceForEdge(dep.edge)
    if (!namespace) {
      throw new Error('Namespace is required before deploy')
    }
    const deploymentName = dep.deploymentName || namespace
    const secretName = dep.secretName || `${namespace}-secrets`
    const configMapName = dep.configMapName || `${namespace}-config`

    await this.patch(orderId, {
      namespace,
      deploymentName,
      secretName,
      configMapName,
      lastDeployStatus: 'pending',
      lastError: null,
    })

    // Re-read so concurrent meta/env saves are not lost
    dep = (await this.getByOrderId(orderId)) || dep

    try {
      await ensureNamespace(dep.edge, namespace)

      const secretData: Record<string, string> = {}
      const configData: Record<string, string> = {}

      for (const [key, entry] of Object.entries(dep.envConfig) as [string, EnvConfigEntry][]) {
        if (!entry?.value) continue
        const plain =
          entry.class === 'secret' && entry.encrypted
            ? decryptLabSecret(entry.value)
            : entry.value
        if (entry.class === 'public' || key.startsWith('NEXT_PUBLIC_')) {
          configData[key] = plain
        } else {
          secretData[key] = plain
        }
      }

      // Keep public URL pair in ConfigMap; NEXTAUTH_URL stays in Secret (never ConfigMap)
      if (configData.NEXT_PUBLIC_BASE_URL) {
        configData.NEXT_PUBLIC_APP_URL ??= configData.NEXT_PUBLIC_BASE_URL
        secretData.NEXTAUTH_URL ??= configData.NEXT_PUBLIC_BASE_URL
      }

      // Order Project Config overlay → ConfigMap (RING_ORDER_PROJECT_CONFIG + brand mirrors)
      try {
        const { ProjectOrderService } = await import(
          '@/features/crm/orders/project-order-service'
        )
        const order = await ProjectOrderService.getById(orderId)
        if (order?.projectConfig && Object.keys(order.projectConfig).length > 0) {
          Object.assign(configData, projectConfigToConfigMapEnv(order.projectConfig))
        }
      } catch (err) {
        logger.warn('Order projectConfig ConfigMap merge skipped', {
          orderId,
          error: err instanceof Error ? err.message : String(err),
        })
      }

      if (Object.keys(secretData).length) {
        await upsertSecret(dep.edge, namespace, secretName, secretData)
      }
      if (Object.keys(configData).length) {
        await upsertConfigMap(dep.edge, namespace, configMapName, configData)
      }

      if (dep.imageTag) {
        const { resolvePlatformDeployImage, RING_FORGEJO_PULL_SECRET } = await import(
          '@/lib/docker-registry'
        )
        const image = resolvePlatformDeployImage(dep.imageTag)
        // Forgejo OCI: ensure pull secret + merge imagePullSecrets (mesh registry SSOT)
        if (isForgejoRegistryImage(image)) {
          const upserted = await ensureForgejoRegistryPullSecret(
            dep.edge,
            namespace,
            RING_FORGEJO_PULL_SECRET,
          )
          if (!upserted) {
            throw new Error(
              'Forgejo image deploy requires RING_FORGEJO_PULL_TOKEN (k8s-pull robot)',
            )
          }
          await ensureImagePullSecrets(dep.edge, namespace, deploymentName, [
            RING_FORGEJO_PULL_SECRET,
          ])
        }
        await setDeploymentImage(dep.edge, namespace, deploymentName, deploymentName, image)
      }

      await rolloutRestart(dep.edge, namespace, deploymentName)

      return this.patch(orderId, {
        lastDeployAt: nowIso(),
        lastDeployStatus: 'success',
        lastError: null,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Deploy failed'
      logger.error('Order lab deploy failed', { orderId, error: message })
      return this.patch(orderId, {
        lastDeployStatus: 'failed',
        lastError: message,
      })
    }
  },

  async listPods(orderId: string): Promise<K8sPodInfo[]> {
    const dep = await this.getOrCreate(orderId)
    const namespace = dep.namespace || defaultNamespaceForEdge(dep.edge)
    if (!namespace) throw new Error('Namespace is required')
    const label = `app.kubernetes.io/name=${dep.deploymentName || namespace}`
    try {
      return await listPods(dep.edge, namespace, label)
    } catch {
      // Fallback: all pods in namespace
      return listPods(dep.edge, namespace)
    }
  },

  async getLogs(orderId: string, pod: string, tailLines = 500): Promise<string> {
    const dep = await this.getOrCreate(orderId)
    const namespace = dep.namespace || defaultNamespaceForEdge(dep.edge)
    if (!namespace) throw new Error('Namespace is required')
    return getPodLogs(dep.edge, namespace, pod, tailLines)
  },

  async restartPod(orderId: string, pod: string): Promise<void> {
    const dep = await this.getOrCreate(orderId)
    const namespace = dep.namespace || defaultNamespaceForEdge(dep.edge)
    if (!namespace) throw new Error('Namespace is required')
    await deletePod(dep.edge, namespace, pod)
  },

  /**
   * Consolidated hero/tab status payload — pods summary + server-side clone health.
   * Browser must not probe clone /api/health (CORS); this runs on the Ring server.
   */
  async getStatusSummary(orderId: string): Promise<{
    deployment: {
      edge: RingEdgeId
      namespace: string
      deploymentName: string
      projectUrl: string | null
      imageTag: string | null
      lastDeployStatus: ProjectDeployment['lastDeployStatus']
      lastError: string | null
      lastDeployAt: string | null
    }
    pods: { total: number; ready: number; restarts: number }
    health: {
      status: 'healthy' | 'degraded' | 'unhealthy' | 'unreachable' | 'not_deployed'
      database?: string | null
      responseMs?: number | null
      error?: string | null
    }
    envEssentialsMissing: string[]
  }> {
    const dep = await this.getOrCreate(orderId)
    let podsList: K8sPodInfo[] = []
    try {
      if (dep.namespace || defaultNamespaceForEdge(dep.edge)) {
        podsList = await this.listPods(orderId)
      }
    } catch {
      podsList = []
    }

    let ready = 0
    let restarts = 0
    for (const p of podsList) {
      const readyStr = String(p.ready || '')
      if (readyStr.includes('/') ? readyStr.split('/')[0] === readyStr.split('/')[1] && readyStr !== '0/0' : p.phase === 'Running') {
        ready += 1
      }
      restarts += Number(p.restarts || 0)
    }

    const essentialsMissing: string[] = []
    for (const key of ENV_ESSENTIALS) {
      const entry = dep.envConfig[key]
      const val = entry?.value ? String(entry.value) : ''
      if (!val.trim()) essentialsMissing.push(key)
    }

    const health = await probeCloneHealth(dep)

    return {
      deployment: {
        edge: dep.edge,
        namespace: dep.namespace || '',
        deploymentName: dep.deploymentName || '',
        projectUrl: dep.projectUrl,
        imageTag: dep.imageTag,
        lastDeployStatus: dep.lastDeployStatus,
        lastError: dep.lastError,
        lastDeployAt: dep.lastDeployAt,
      },
      pods: { total: podsList.length, ready, restarts },
      health,
      envEssentialsMissing: essentialsMissing,
    }
  },
}
