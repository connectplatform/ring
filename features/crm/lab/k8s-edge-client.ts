import 'server-only'

import { logger } from '@/lib/logger'
import { parseResponseJsonSafe } from '@/features/crm/lab/safe-fetch-json'

export type RingEdgeId = 'us' | 'fi' | 'ua'

export const RING_EDGES: { id: RingEdgeId; label: string }[] = [
  { id: 'us', label: 'United States' },
  { id: 'fi', label: 'Finland' },
  { id: 'ua', label: 'Ukraine' },
]

type EdgeConfig = {
  apiUrl: string
  token: string
  namespace: string
}

function loadEdge(id: RingEdgeId): EdgeConfig | null {
  const prefix = `RING_EDGE_${id.toUpperCase()}`
  const apiUrl = process.env[`${prefix}_API_URL`]?.replace(/\/$/, '')
  const token = process.env[`${prefix}_TOKEN`]
  const namespace = process.env[`${prefix}_NAMESPACE`] || ''
  if (!apiUrl || !token) return null
  return { apiUrl, token, namespace }
}

export function getEdgeAvailability(): Record<RingEdgeId, boolean> {
  return {
    us: Boolean(loadEdge('us')),
    fi: Boolean(loadEdge('fi')),
    ua: Boolean(loadEdge('ua')),
  }
}


async function readJson<T>(res: Response): Promise<T> {
  const parsed = await parseResponseJsonSafe<T>(res)
  if (parsed.data == null) {
    throw new Error(parsed.error || `Empty k8s JSON (HTTP ${res.status})`)
  }
  return parsed.data
}

async function k8sFetch(
  edge: RingEdgeId,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const cfg = loadEdge(edge)
  if (!cfg) {
    throw new Error(`Edge "${edge}" is not configured (missing API_URL or TOKEN)`)
  }
  const url = `${cfg.apiUrl}${path.startsWith('/') ? path : `/${path}`}`

  // Self-signed / private CA cluster APIs (k3s) — opt-in only
  let dispatcher: unknown
  if (process.env.RING_EDGE_TLS_INSECURE === 'true' || process.env.RING_EDGE_TLS_INSECURE === '1') {
    try {
      const { Agent } = await import('undici')
      dispatcher = new Agent({ connect: { rejectUnauthorized: false } })
    } catch (error) {
      logger.warn('RING_EDGE_TLS_INSECURE set but undici Agent unavailable', { error })
    }
  }

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
    // Never cache cluster state
    cache: 'no-store',
    ...(dispatcher ? { dispatcher } : {}),
  } as RequestInit)
  return res
}

export type K8sPodInfo = {
  name: string
  phase: string
  ready: string
  restarts: number
  age: string
  node?: string
}

export async function getDeployment(
  edge: RingEdgeId,
  namespace: string,
  name: string,
): Promise<Record<string, unknown> | null> {
  const res = await k8sFetch(
    edge,
    `/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments/${encodeURIComponent(name)}`,
  )
  if (res.status === 404) return null
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`getDeployment failed: ${res.status} ${text.slice(0, 200)}`)
  }
  return await readJson<Record<string, unknown>>(res)
}

export async function ensureNamespace(edge: RingEdgeId, namespace: string): Promise<void> {
  const path = `/api/v1/namespaces/${encodeURIComponent(namespace)}`
  const existing = await k8sFetch(edge, path, { method: 'GET' })
  if (existing.ok) return
  if (existing.status !== 404) {
    const text = await existing.text().catch(() => '')
    throw new Error(`ensureNamespace get failed: ${existing.status} ${text.slice(0, 200)}`)
  }
  const res = await k8sFetch(edge, `/api/v1/namespaces`, {
    method: 'POST',
    body: JSON.stringify({
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: {
        name: namespace,
        labels: {
          'app.kubernetes.io/managed-by': 'ring-order-lab',
        },
      },
    }),
  })
  if (!res.ok && res.status !== 409) {
    const text = await res.text().catch(() => '')
    throw new Error(`ensureNamespace create failed: ${res.status} ${text.slice(0, 200)}`)
  }
}

export async function upsertSecret(
  edge: RingEdgeId,
  namespace: string,
  name: string,
  data: Record<string, string>,
): Promise<void> {
  const body = {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: { name, namespace },
    type: 'Opaque',
    stringData: data,
  }
  const path = `/api/v1/namespaces/${encodeURIComponent(namespace)}/secrets/${encodeURIComponent(name)}`
  let res = await k8sFetch(edge, path, { method: 'PUT', body: JSON.stringify(body) })
  if (res.status === 404) {
    res = await k8sFetch(edge, `/api/v1/namespaces/${encodeURIComponent(namespace)}/secrets`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`upsertSecret failed: ${res.status} ${text.slice(0, 200)}`)
  }
}

export async function upsertConfigMap(
  edge: RingEdgeId,
  namespace: string,
  name: string,
  data: Record<string, string>,
): Promise<void> {
  const body = {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: { name, namespace },
    data,
  }
  const path = `/api/v1/namespaces/${encodeURIComponent(namespace)}/configmaps/${encodeURIComponent(name)}`
  let res = await k8sFetch(edge, path, { method: 'PUT', body: JSON.stringify(body) })
  if (res.status === 404) {
    res = await k8sFetch(edge, `/api/v1/namespaces/${encodeURIComponent(namespace)}/configmaps`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`upsertConfigMap failed: ${res.status} ${text.slice(0, 200)}`)
  }
}

export async function rolloutRestart(
  edge: RingEdgeId,
  namespace: string,
  name: string,
): Promise<void> {
  const patch = {
    spec: {
      template: {
        metadata: {
          annotations: {
            'kubectl.kubernetes.io/restartedAt': new Date().toISOString(),
          },
        },
      },
    },
  }
  const res = await k8sFetch(
    edge,
    `/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments/${encodeURIComponent(name)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/strategic-merge-patch+json' },
      body: JSON.stringify(patch),
    },
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`rolloutRestart failed: ${res.status} ${text.slice(0, 200)}`)
  }
}

export async function setDeploymentImage(
  edge: RingEdgeId,
  namespace: string,
  name: string,
  containerName: string,
  image: string,
): Promise<void> {
  const patch = [
    {
      op: 'replace',
      path: `/spec/template/spec/containers/0/image`,
      value: image,
    },
  ]
  // Prefer strategic merge on container image
  const mergePatch = {
    spec: {
      template: {
        spec: {
          containers: [{ name: containerName || name, image }],
        },
      },
    },
  }
  const res = await k8sFetch(
    edge,
    `/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments/${encodeURIComponent(name)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/strategic-merge-patch+json' },
      body: JSON.stringify(mergePatch),
    },
  )
  if (!res.ok) {
    logger.warn('setDeploymentImage strategic merge failed, trying JSON patch', {
      status: res.status,
    })
    const res2 = await k8sFetch(
      edge,
      `/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments/${encodeURIComponent(name)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json-patch+json' },
        body: JSON.stringify(patch),
      },
    )
    if (!res2.ok) {
      const text = await res2.text().catch(() => '')
      throw new Error(`setDeploymentImage failed: ${res2.status} ${text.slice(0, 200)}`)
    }
  }
}

const FORGEJO_REGISTRY_HOSTS = ['registry.ringdom.org', 'forge.ringdom.org']

/** True when image is hosted on Ringdom Forgejo OCI. */
export function isForgejoRegistryImage(image: string): boolean {
  return FORGEJO_REGISTRY_HOSTS.some(
    (host) => image === host || image.startsWith(`${host}/`),
  )
}

/**
 * Merge imagePullSecrets onto a Deployment without dropping existing entries.
 * Ring mesh SSOT pull secret is forgejo-registry (registry.ringdom.org).
 * Uses JSON merge-patch with the full merged list so the array is set atomically.
 */
export async function ensureImagePullSecrets(
  edge: RingEdgeId,
  namespace: string,
  deploymentName: string,
  secretNames: string[],
): Promise<void> {
  const wanted = [...new Set(secretNames.filter(Boolean))]
  if (!wanted.length) return

  const current = await getDeployment(edge, namespace, deploymentName)
  if (!current) {
    throw new Error(
      `ensureImagePullSecrets: deployment ${namespace}/${deploymentName} not found`,
    )
  }
  const spec = (current.spec || {}) as {
    template?: { spec?: { imagePullSecrets?: Array<{ name?: string }> } }
  }
  const existing = (spec.template?.spec?.imagePullSecrets || [])
    .map((s) => s.name)
    .filter((n): n is string => Boolean(n))
  const merged = [...new Set([...existing, ...wanted])]
  if (
    merged.length === existing.length &&
    merged.every((n) => existing.includes(n))
  ) {
    return
  }

  const mergePatch = {
    spec: {
      template: {
        spec: {
          imagePullSecrets: merged.map((name) => ({ name })),
        },
      },
    },
  }
  const res = await k8sFetch(
    edge,
    `/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments/${encodeURIComponent(deploymentName)}`,
    {
      method: 'PATCH',
      // merge-patch replaces the imagePullSecrets array with our full merged list
      headers: { 'Content-Type': 'application/merge-patch+json' },
      body: JSON.stringify(mergePatch),
    },
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`ensureImagePullSecrets failed: ${res.status} ${text.slice(0, 200)}`)
  }
}

/**
 * Ensure dockerconfigjson pull secret exists for Forgejo registry (+ forge realm host).
 * Credentials from RING_FORGEJO_PULL_USER + RING_FORGEJO_PULL_TOKEN (k8s-pull robot).
 * Returns false when token is unset (caller must fail hard for Forgejo images).
 */
export async function ensureForgejoRegistryPullSecret(
  edge: RingEdgeId,
  namespace: string,
  secretName = 'forgejo-registry',
): Promise<boolean> {
  const user = process.env.RING_FORGEJO_PULL_USER || 'k8s-pull'
  const token = process.env.RING_FORGEJO_PULL_TOKEN
  if (!token) {
    logger.warn('RING_FORGEJO_PULL_TOKEN unset; cannot upsert forgejo-registry secret', {
      edge,
      namespace,
    })
    return false
  }
  const auth = Buffer.from(`${user}:${token}`).toString('base64')
  const dockerconfig = {
    auths: {
      'registry.ringdom.org': { username: user, password: token, auth },
      'forge.ringdom.org': { username: user, password: token, auth },
    },
  }
  const path = `/api/v1/namespaces/${encodeURIComponent(namespace)}/secrets/${encodeURIComponent(secretName)}`
  const existingRes = await k8sFetch(edge, path, { method: 'GET' })
  if (existingRes.status === 404) {
    const createBody = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: { name: secretName, namespace },
      type: 'kubernetes.io/dockerconfigjson',
      stringData: {
        '.dockerconfigjson': JSON.stringify(dockerconfig),
      },
    }
    const res = await k8sFetch(edge, `/api/v1/namespaces/${encodeURIComponent(namespace)}/secrets`, {
      method: 'POST',
      body: JSON.stringify(createBody),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(
        `ensureForgejoRegistryPullSecret create failed: ${res.status} ${text.slice(0, 200)}`,
      )
    }
    return true
  }
  if (!existingRes.ok) {
    const text = await existingRes.text().catch(() => '')
    throw new Error(
      `ensureForgejoRegistryPullSecret get failed: ${existingRes.status} ${text.slice(0, 200)}`,
    )
  }
  const existing = await readJson<{
    metadata?: { resourceVersion?: string; name?: string }
  }>(existingRes)
  const updateBody = {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: {
      name: secretName,
      namespace,
      resourceVersion: existing.metadata?.resourceVersion,
    },
    type: 'kubernetes.io/dockerconfigjson',
    stringData: {
      '.dockerconfigjson': JSON.stringify(dockerconfig),
    },
  }
  const res = await k8sFetch(edge, path, { method: 'PUT', body: JSON.stringify(updateBody) })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `ensureForgejoRegistryPullSecret update failed: ${res.status} ${text.slice(0, 200)}`,
    )
  }
  return true
}

export async function listPods(
  edge: RingEdgeId,
  namespace: string,
  labelSelector?: string,
): Promise<K8sPodInfo[]> {
  const qs = labelSelector
    ? `?labelSelector=${encodeURIComponent(labelSelector)}`
    : ''
  const res = await k8sFetch(
    edge,
    `/api/v1/namespaces/${encodeURIComponent(namespace)}/pods${qs}`,
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`listPods failed: ${res.status} ${text.slice(0, 200)}`)
  }
  const json = await readJson<{
    items?: Array<{
      metadata?: { name?: string; creationTimestamp?: string }
      status?: {
        phase?: string
        containerStatuses?: Array<{ ready?: boolean; restartCount?: number }>
      }
      spec?: { nodeName?: string }
    }>
  }>(res)
  return (json.items || []).map((pod) => {
    const statuses = pod.status?.containerStatuses || []
    const readyCount = statuses.filter((s) => s.ready).length
    const restarts = statuses.reduce((n, s) => n + (s.restartCount || 0), 0)
    return {
      name: pod.metadata?.name || 'unknown',
      phase: pod.status?.phase || 'Unknown',
      ready: `${readyCount}/${statuses.length || 0}`,
      restarts,
      age: pod.metadata?.creationTimestamp || '',
      node: pod.spec?.nodeName,
    }
  })
}

export async function getPodLogs(
  edge: RingEdgeId,
  namespace: string,
  pod: string,
  tailLines = 500,
): Promise<string> {
  const res = await k8sFetch(
    edge,
    `/api/v1/namespaces/${encodeURIComponent(namespace)}/pods/${encodeURIComponent(pod)}/log?tailLines=${tailLines}`,
    { headers: { Accept: 'text/plain' } },
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`getPodLogs failed: ${res.status} ${text.slice(0, 200)}`)
  }
  const text = await res.text()
  // Strip likely secret patterns
  return text
    .replace(/(Bearer\s+)[A-Za-z0-9._\-]+/gi, '$1[REDACTED]')
    .replace(/((?:password|secret|token|api[_-]?key)\s*[=:]\s*)\S+/gi, '$1[REDACTED]')
}

export async function deletePod(
  edge: RingEdgeId,
  namespace: string,
  pod: string,
): Promise<void> {
  const res = await k8sFetch(
    edge,
    `/api/v1/namespaces/${encodeURIComponent(namespace)}/pods/${encodeURIComponent(pod)}`,
    { method: 'DELETE' },
  )
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '')
    throw new Error(`deletePod failed: ${res.status} ${text.slice(0, 200)}`)
  }
}

export type K8sJobStatus = {
  name: string
  active: number
  succeeded: number
  failed: number
  completionTime?: string
  startTime?: string
  conditions?: Array<{ type?: string; status?: string; reason?: string; message?: string }>
}

/**
 * Create a batch/v1 Job (e.g. BuildKit / clone scaffold on FI edge).
 * Caller supplies full Job object (apiVersion/kind/metadata/spec).
 */
export async function createJob(
  edge: RingEdgeId,
  namespace: string,
  job: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const meta = (job.metadata || {}) as Record<string, unknown>
  const body = {
    ...job,
    apiVersion: 'batch/v1',
    kind: 'Job',
    metadata: { ...meta, namespace },
  }
  const res = await k8sFetch(
    edge,
    `/apis/batch/v1/namespaces/${encodeURIComponent(namespace)}/jobs`,
    { method: 'POST', body: JSON.stringify(body) },
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`createJob failed: ${res.status} ${text.slice(0, 300)}`)
  }
  return await readJson<Record<string, unknown>>(res)
}

export async function getJob(
  edge: RingEdgeId,
  namespace: string,
  name: string,
): Promise<K8sJobStatus | null> {
  const res = await k8sFetch(
    edge,
    `/apis/batch/v1/namespaces/${encodeURIComponent(namespace)}/jobs/${encodeURIComponent(name)}`,
  )
  if (res.status === 404) return null
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`getJob failed: ${res.status} ${text.slice(0, 200)}`)
  }
  const json = await readJson<{
    metadata?: { name?: string }
    status?: {
      active?: number
      succeeded?: number
      failed?: number
      completionTime?: string
      startTime?: string
      conditions?: K8sJobStatus['conditions']
    }
  }>(res)
  return {
    name: json.metadata?.name || name,
    active: json.status?.active || 0,
    succeeded: json.status?.succeeded || 0,
    failed: json.status?.failed || 0,
    completionTime: json.status?.completionTime,
    startTime: json.status?.startTime,
    conditions: json.status?.conditions,
  }
}

export function defaultNamespaceForEdge(edge: RingEdgeId): string {
  return loadEdge(edge)?.namespace || ''
}
