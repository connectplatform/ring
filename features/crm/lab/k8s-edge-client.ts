import 'server-only'

import { logger } from '@/lib/logger'

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
  return (await res.json()) as Record<string, unknown>
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
  const json = (await res.json()) as {
    items?: Array<{
      metadata?: { name?: string; creationTimestamp?: string }
      status?: {
        phase?: string
        containerStatuses?: Array<{ ready?: boolean; restartCount?: number }>
      }
      spec?: { nodeName?: string }
    }>
  }
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

export function defaultNamespaceForEdge(edge: RingEdgeId): string {
  return loadEdge(edge)?.namespace || ''
}
