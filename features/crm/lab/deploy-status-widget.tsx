'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, RefreshCw, Rocket, GitBranch, Hammer } from 'lucide-react'
import { fetchJsonSafe } from '@/features/crm/lab/safe-fetch-json'
import { useOptionalOrderLabTabStatus } from '@/features/crm/lab/order-lab-tab-status-context'
import { tabStatusFromDeploySnapshot } from '@/features/crm/lab/order-lab-tab-status'

type EdgeId = 'us' | 'fi' | 'ua'
type Pod = {
  name: string
  phase: string
  ready: string
  restarts: number
  age: string
  node?: string
}

export function DeployStatusWidget({ orderId }: { orderId: string }) {
  const t = useTranslations('calculator')
  const { data: session } = useSession()
  const tabCtx = useOptionalOrderLabTabStatus()
  const canEditNamespace = isPlatformAdmin(session?.user?.role)
  const [pending, startTransition] = useTransition()
  const [edge, setEdge] = useState<EdgeId>('us')
  const [edges, setEdges] = useState<Record<EdgeId, boolean>>({ us: false, fi: false, ua: false })
  const [edgeLabels, setEdgeLabels] = useState<Array<{ id: EdgeId; label: string }>>([])
  const [namespace, setNamespace] = useState('')
  const [deploymentName, setDeploymentName] = useState('')
  const [imageTag, setImageTag] = useState('')
  const [gitUrl, setGitUrl] = useState<string | null>(null)
  const [bridgeJob, setBridgeJob] = useState<string | null>(null)
  const [bridgeAction, setBridgeAction] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('idle')
  const [lastError, setLastError] = useState<string | null>(null)
  const [pods, setPods] = useState<Pod[]>([])
  const [logs, setLogs] = useState<string | null>(null)
  const [logPod, setLogPod] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const bumpShell = useCallback(
    (snap: {
      lastDeployStatus?: string | null
      lastError?: string | null
      namespace?: string
      pods?: Pod[]
    }) => {
      tabCtx?.refreshHero()
      tabCtx?.setTabStatus('deploy', tabStatusFromDeploySnapshot(snap))
    },
    [tabCtx],
  )

  const load = useCallback(async () => {
    const { ok, data, error: parseErr } = await fetchJsonSafe<{
      error?: string
      deployment?: {
        edge?: EdgeId
        namespace?: string
        deploymentName?: string
        imageTag?: string
        gitUrl?: string | null
        lastDeployStatus?: string
        lastError?: string | null
        projectUrl?: string | null
      }
      edges?: Record<EdgeId, boolean>
      edgeLabels?: Array<{ id: EdgeId; label: string }>
    }>(`/api/my-jobs/${orderId}/deployment`)
    if (!ok || !data) throw new Error(parseErr || data?.error || 'Failed to load')
    if (data.error) throw new Error(data.error)
    const d = data.deployment
    if (!d) throw new Error('Deployment missing')
    setEdge(d.edge || 'us')
    setEdges(data.edges || { us: false, fi: false, ua: false })
    setEdgeLabels(data.edgeLabels || [])
    setNamespace(d.namespace || '')
    setDeploymentName(d.deploymentName || '')
    setImageTag(d.imageTag || '')
    setGitUrl(d.gitUrl || null)
    setStatus(d.lastDeployStatus || 'idle')
    setLastError(d.lastError ?? null)
    return d
  }, [orderId])

  const loadPods = useCallback(async () => {
    const { ok, data, error: parseErr } = await fetchJsonSafe<{
      error?: string
      pods?: Pod[]
    }>(`/api/my-jobs/${orderId}/deployment/pods`)
    if (!ok || !data) throw new Error(parseErr || data?.error || 'Failed to list pods')
    if (data.error) throw new Error(data.error)
    const nextPods = data.pods || []
    setPods(nextPods)
    return nextPods
  }, [orderId])

  useEffect(() => {
    startTransition(() => {
      void (async () => {
        try {
          const d = await load()
          const nextPods = await loadPods().catch(() => [] as Pod[])
          bumpShell({
            lastDeployStatus: d.lastDeployStatus,
            lastError: d.lastError,
            namespace: d.namespace || '',
            pods: nextPods,
          })
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Load failed')
        }
      })()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount + orderId via load
  }, [load, loadPods, bumpShell])

  const persistMeta = async () => {
    // Namespace / edge / deploymentName are admin-only (CRM namespace lock).
    // Integrators may only persist imageTag — sending locked fields yields 403.
    const body = canEditNamespace
      ? {
          edge,
          namespace,
          deploymentName: deploymentName || namespace,
          imageTag: imageTag || null,
        }
      : { imageTag: imageTag || null }
    const { ok, data, error: parseErr } = await fetchJsonSafe<{ error?: string }>(
      `/api/my-jobs/${orderId}/deployment`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    )
    if (!ok || !data) throw new Error(parseErr || data?.error || 'Save failed')
    if (data.error) throw new Error(data.error)
    bumpShell({
      lastDeployStatus: status,
      lastError,
      namespace,
      pods,
    })
    return data
  }

  const saveMeta = () => {
    setError(null)
    startTransition(async () => {
      try {
        await persistMeta()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Save failed')
      }
    })
  }

  const deploy = () => {
    setError(null)
    startTransition(async () => {
      try {
        // Must await real PATCH — previous saveMeta() returned void (race → empty namespace)
        await persistMeta()
        const { ok, data, error: parseErr } = await fetchJsonSafe<{
          error?: string
          success?: boolean
          deployment?: { lastDeployStatus?: string; lastError?: string | null }
        }>(`/api/my-jobs/${orderId}/deployment/deploy`, { method: 'POST' })
        if (!ok || !data) throw new Error(parseErr || data?.error || 'Deploy failed')
        if (data.error && data.success === false) throw new Error(data.error)
        if (data.error && !data.deployment) throw new Error(data.error)
        const nextStatus = data.deployment?.lastDeployStatus || 'success'
        const nextErr = data.deployment?.lastError || null
        setStatus(nextStatus)
        setLastError(nextErr)
        const nextPods = await loadPods().catch(() => pods)
        bumpShell({
          lastDeployStatus: nextStatus,
          lastError: nextErr,
          namespace,
          pods: nextPods,
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Deploy failed')
        setStatus('failed')
        bumpShell({
          lastDeployStatus: 'failed',
          lastError: e instanceof Error ? e.message : 'Deploy failed',
          namespace,
          pods,
        })
      }
    })
  }

  const runCloneBridge = (action: 'scaffold' | 'build') => {
    setError(null)
    startTransition(async () => {
      try {
        const path =
          action === 'scaffold'
            ? `/api/my-jobs/${orderId}/deployment/clone-bridge/scaffold`
            : `/api/my-jobs/${orderId}/deployment/clone-bridge/build`
        const { ok, data, error: parseErr } = await fetchJsonSafe<{
          error?: string
          success?: boolean
          jobName?: string
          plan?: { gitUrl?: string; imageTag?: string }
        }>(path, { method: 'POST' })
        if (!ok || !data || data.success === false) {
          throw new Error(data?.error || parseErr || `${action} failed`)
        }
        setBridgeJob(data.jobName || null)
        setBridgeAction(action)
        setGitUrl(data.plan?.gitUrl || gitUrl)
        if (data.plan?.imageTag) setImageTag(data.plan.imageTag)
        setStatus('pending')
        const d = await load()
        const nextPods = await loadPods().catch(() => pods)
        bumpShell({
          lastDeployStatus: d.lastDeployStatus || 'pending',
          lastError: d.lastError,
          namespace: d.namespace || namespace,
          pods: nextPods,
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : `${action} failed`)
        setStatus('failed')
        bumpShell({
          lastDeployStatus: 'failed',
          lastError: e instanceof Error ? e.message : `${action} failed`,
          namespace,
          pods,
        })
      }
    })
  }

  const refreshBridgeJob = () => {
    if (!bridgeJob) return
    startTransition(async () => {
      try {
        const { ok, data, error: parseErr } = await fetchJsonSafe<{
          error?: string
          job?: { succeeded: number; failed: number }
        }>(
          `/api/my-jobs/${orderId}/deployment/clone-bridge/scaffold?job=${encodeURIComponent(bridgeJob)}`,
        )
        if (!ok || !data) throw new Error(parseErr || data?.error || 'Job status failed')
        if (data.error) throw new Error(data.error)
        const j = data.job
        if (!j) {
          setError('Job not found')
          return
        }
        if (j.succeeded > 0) setStatus('success')
        else if (j.failed > 0) setStatus('failed')
        else setStatus('pending')
        bumpShell({
          lastDeployStatus:
            j.succeeded > 0 ? 'success' : j.failed > 0 ? 'failed' : 'pending',
          lastError: j.failed > 0 ? 'bridge_job_failed' : null,
          namespace,
          pods,
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Job status failed')
      }
    })
  }

  const viewLogs = (pod: string) => {
    startTransition(async () => {
      try {
        const { ok, data, error: parseErr } = await fetchJsonSafe<{
          error?: string
          logs?: string
        }>(`/api/my-jobs/${orderId}/deployment/pods/${encodeURIComponent(pod)}/logs`)
        if (!ok || !data) throw new Error(parseErr || data?.error || 'Logs failed')
        if (data.error) throw new Error(data.error)
        setLogPod(pod)
        setLogs(data.logs || '')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Logs failed')
      }
    })
  }

  const restart = (pod: string) => {
    startTransition(async () => {
      try {
        const { ok, data, error: parseErr } = await fetchJsonSafe<{ error?: string }>(
          `/api/my-jobs/${orderId}/deployment/pods/${encodeURIComponent(pod)}/restart`,
          { method: 'POST' },
        )
        if (!ok || !data) throw new Error(parseErr || data?.error || 'Restart failed')
        if (data.error) throw new Error(data.error)
        await loadPods().then((nextPods) => {
          bumpShell({
            lastDeployStatus: status,
            lastError,
            namespace,
            pods: nextPods,
          })
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Restart failed')
      }
    })
  }

  const edgeAvailable = edges[edge]

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">{t('order.lab.deployTitle')}</CardTitle>
        <Badge variant={status === 'success' ? 'default' : status === 'failed' ? 'destructive' : 'outline'}>
          {status}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {lastError ? <p className="text-xs text-destructive">{lastError}</p> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>{t('order.lab.edge')}</Label>
            <Select
              disabled={pending || !canEditNamespace}
              value={edge}
              onValueChange={(v) => setEdge(v as EdgeId)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(edgeLabels.length
                  ? edgeLabels
                  : [
                      { id: 'us' as const, label: 'United States' },
                      { id: 'fi' as const, label: 'Finland' },
                      { id: 'ua' as const, label: 'Ukraine' },
                    ]
                ).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.label}
                    {!edges[e.id] ? ` (${t('order.lab.edgeUnavailable')})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{t('order.lab.namespace')}</Label>
            <Input
              disabled={pending || !canEditNamespace}
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              placeholder="ring-example-org"
            />
          </div>
          <div className="space-y-1">
            <Label>{t('order.lab.deploymentName')}</Label>
            <Input
              disabled={pending || !canEditNamespace}
              value={deploymentName}
              onChange={(e) => setDeploymentName(e.target.value)}
              placeholder={namespace || 'deployment'}
            />
          </div>
          <div className="space-y-1">
            <Label>{t('order.lab.imageTag')}</Label>
            <Input
              disabled={pending}
              value={imageTag}
              onChange={(e) => setImageTag(e.target.value)}
              placeholder="v1.x.y-slug-amd64"
            />
          </div>
        </div>

        {gitUrl ? (
          <p className="truncate font-mono text-xs text-muted-foreground" title={gitUrl}>
            {t('order.lab.gitUrl')}: {gitUrl}
          </p>
        ) : null}

        {!canEditNamespace ? (
          <p className="text-xs text-muted-foreground">{t('order.lab.namespaceAdminLock')}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} size="sm" variant="secondary" onClick={saveMeta}>
            {t('order.lab.saveDeployMeta')}
          </Button>
          <Button
            disabled={pending || !edges.fi}
            size="sm"
            variant="outline"
            onClick={() => runCloneBridge('scaffold')}
          >
            <GitBranch className="mr-2 h-4 w-4" />
            {t('order.lab.scaffoldClone')}
          </Button>
          <Button
            disabled={pending || !edges.fi}
            size="sm"
            variant="outline"
            onClick={() => runCloneBridge('build')}
          >
            <Hammer className="mr-2 h-4 w-4" />
            {t('order.lab.buildImage')}
          </Button>
          <Button disabled={pending || !edgeAvailable || !namespace} size="sm" onClick={deploy}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
            {t('order.lab.deploy')}
          </Button>
          <Button
            disabled={pending || !namespace}
            size="sm"
            variant="outline"
            onClick={() =>
              startTransition(() => {
                void loadPods().catch((e) => setError(e instanceof Error ? e.message : 'Pods failed'))
              })
            }
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('order.lab.refreshPods')}
          </Button>
        </div>

        {bridgeJob ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">
              {bridgeAction}: {bridgeJob}
            </span>
            <Button disabled={pending} size="sm" variant="ghost" onClick={refreshBridgeJob}>
              {t('order.lab.refreshJob')}
            </Button>
          </div>
        ) : null}

        {!edges.fi ? (
          <p className="text-xs text-muted-foreground">{t('order.lab.cloneBridgeFiHint')}</p>
        ) : null}

        {!edgeAvailable ? (
          <p className="text-xs text-muted-foreground">{t('order.lab.edgeUnavailableHint')}</p>
        ) : null}

        {pods.length > 0 ? (
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="p-2">Pod</th>
                  <th className="p-2">Phase</th>
                  <th className="p-2">Ready</th>
                  <th className="p-2">Restarts</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {pods.map((p) => (
                  <tr key={p.name} className="border-t">
                    <td className="p-2 font-mono">{p.name}</td>
                    <td className="p-2">{p.phase}</td>
                    <td className="p-2">{p.ready}</td>
                    <td className="p-2">{p.restarts}</td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <Button disabled={pending} size="sm" variant="ghost" onClick={() => viewLogs(p.name)}>
                          {t('order.lab.viewLogs')}
                        </Button>
                        <Button disabled={pending} size="sm" variant="ghost" onClick={() => restart(p.name)}>
                          {t('order.lab.restartPod')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <Dialog open={logs !== null} onOpenChange={(o) => !o && setLogs(null)}>
          <DialogContent className="max-h-[80vh] max-w-3xl overflow-hidden">
            <DialogHeader>
              <DialogTitle className="font-mono text-sm">{logPod}</DialogTitle>
            </DialogHeader>
            <pre className="max-h-[60vh] overflow-auto rounded bg-muted/40 p-3 text-[11px] leading-relaxed">
              {logs}
            </pre>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
