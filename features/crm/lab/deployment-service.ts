import 'server-only'

import { db, initializeDatabase } from '@/lib/database'
import {
  encryptLabSecret,
  decryptLabSecret,
  maskEnvMap,
  type MaskedEnvValue,
} from '@/features/crm/lab/lab-secret-crypto'
import { getEnvTemplateManifest, isAllowedEnvKey } from '@/features/crm/lab/env-template-parser'
import {
  type RingEdgeId,
  getEdgeAvailability,
  upsertSecret,
  upsertConfigMap,
  rolloutRestart,
  setDeploymentImage,
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

export type ProjectDeployment = {
  id: string
  orderId: string
  edge: RingEdgeId
  envConfig: Record<string, EnvConfigEntry>
  projectUrl: string | null
  projectName: string | null
  imageTag: string | null
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

  toMasked(dep: ProjectDeployment): {
    deployment: Omit<ProjectDeployment, 'envConfig'> & { envConfig: Record<string, MaskedEnvValue> }
    edges: Record<RingEdgeId, boolean>
    essentials: string[]
    groups: ReturnType<typeof getEnvTemplateManifest>['groups']
  } {
    const manifest = getEnvTemplateManifest()
    const { envConfig, ...rest } = dep
    return {
      deployment: { ...rest, envConfig: maskEnvMap(envConfig) },
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

      if (Object.keys(secretData).length) {
        await upsertSecret(dep.edge, namespace, secretName, secretData)
      }
      if (Object.keys(configData).length) {
        await upsertConfigMap(dep.edge, namespace, configMapName, configData)
      }

      if (dep.imageTag) {
        const image = dep.imageTag.includes('/')
          ? dep.imageTag
          : `ghcr.io/connectplatform/ring:${dep.imageTag}`
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
}
