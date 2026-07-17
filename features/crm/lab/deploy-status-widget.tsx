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
import { Loader2, RefreshCw, Rocket } from 'lucide-react'

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
  const canEditNamespace = isPlatformAdmin(session?.user?.role)
  const [pending, startTransition] = useTransition()
  const [edge, setEdge] = useState<EdgeId>('us')
  const [edges, setEdges] = useState<Record<EdgeId, boolean>>({ us: false, fi: false, ua: false })
  const [edgeLabels, setEdgeLabels] = useState<Array<{ id: EdgeId; label: string }>>([])
  const [namespace, setNamespace] = useState('')
  const [deploymentName, setDeploymentName] = useState('')
  const [imageTag, setImageTag] = useState('')
  const [status, setStatus] = useState<string>('idle')
  const [lastError, setLastError] = useState<string | null>(null)
  const [pods, setPods] = useState<Pod[]>([])
  const [logs, setLogs] = useState<string | null>(null)
  const [logPod, setLogPod] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/my-jobs/${orderId}/deployment`)
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Failed to load')
    const d = json.deployment
    if (!d) throw new Error('Deployment missing')
    setEdge(d.edge || 'us')
    setEdges(json.edges || {})
    setEdgeLabels(json.edgeLabels || [])
    setNamespace(d.namespace || '')
    setDeploymentName(d.deploymentName || '')
    setImageTag(d.imageTag || '')
    setStatus(d.lastDeployStatus || 'idle')
    setLastError(d.lastError)
  }, [orderId])

  const loadPods = useCallback(async () => {
    const res = await fetch(`/api/my-jobs/${orderId}/deployment/pods`)
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Failed to list pods')
    setPods(json.pods || [])
  }, [orderId])

  useEffect(() => {
    startTransition(() => {
      void load().catch((e) => setError(e instanceof Error ? e.message : 'Load failed'))
    })
  }, [load])

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
    const res = await fetch(`/api/my-jobs/${orderId}/deployment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Save failed')
    return json
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
        const res = await fetch(`/api/my-jobs/${orderId}/deployment/deploy`, { method: 'POST' })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Deploy failed')
        if (json.error && json.success === false) throw new Error(json.error)
        setStatus(json.deployment?.lastDeployStatus || 'success')
        setLastError(json.deployment?.lastError || null)
        await loadPods()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Deploy failed')
        setStatus('failed')
      }
    })
  }

  const viewLogs = (pod: string) => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/my-jobs/${orderId}/deployment/pods/${encodeURIComponent(pod)}/logs`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Logs failed')
        setLogPod(pod)
        setLogs(json.logs || '')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Logs failed')
      }
    })
  }

  const restart = (pod: string) => {
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/my-jobs/${orderId}/deployment/pods/${encodeURIComponent(pod)}/restart`,
          { method: 'POST' },
        )
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Restart failed')
        await loadPods()
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

        {!canEditNamespace ? (
          <p className="text-xs text-muted-foreground">{t('order.lab.namespaceAdminLock')}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} size="sm" variant="secondary" onClick={saveMeta}>
            {t('order.lab.saveDeployMeta')}
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
