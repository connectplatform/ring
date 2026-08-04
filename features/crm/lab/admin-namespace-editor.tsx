'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { fetchJsonSafe } from '@/features/crm/lab/safe-fetch-json'

type EdgeId = 'us' | 'fi' | 'ua'

/**
 * Admin-only namespace / project name / edge editor for CRM order detail.
 */
export function AdminNamespaceEditor({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition()
  const [edge, setEdge] = useState<EdgeId>('us')
  const [namespace, setNamespace] = useState('')
  const [projectName, setProjectName] = useState('')
  const [deploymentName, setDeploymentName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    const { ok, data, error: parseErr } = await fetchJsonSafe<{
      error?: string
      deployment?: {
        edge?: EdgeId
        namespace?: string
        projectName?: string
        deploymentName?: string
      }
    }>(`/api/my-jobs/${orderId}/deployment`)
    if (!ok || !data) throw new Error(parseErr || data?.error || 'Failed to load')
    if (data.error) throw new Error(data.error)
    const d = data.deployment
    if (!d) throw new Error('Deployment missing')
    setEdge(d.edge || 'us')
    setNamespace(d.namespace || '')
    setProjectName(d.projectName || '')
    setDeploymentName(d.deploymentName || '')
  }, [orderId])

  useEffect(() => {
    startTransition(() => {
      void load().catch((e) => setError(e instanceof Error ? e.message : 'Load failed'))
    })
  }, [load])

  const save = () => {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      try {
        const { ok, data, error: parseErr } = await fetchJsonSafe<{ error?: string }>(
          `/api/my-jobs/${orderId}/deployment`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              edge,
              namespace,
              projectName: projectName || null,
              deploymentName: deploymentName || namespace,
            }),
          },
        )
        if (!ok || !data) throw new Error(parseErr || data?.error || 'Save failed')
        if (data.error) throw new Error(data.error)
        setSaved(true)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Save failed')
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Namespace & project</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {saved ? <p className="text-sm text-muted-foreground">Saved — Reggie lock synced.</p> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Edge</Label>
            <Select disabled={pending} value={edge} onValueChange={(v) => setEdge(v as EdgeId)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="us">United States</SelectItem>
                <SelectItem value="fi">Finland</SelectItem>
                <SelectItem value="ua">Ukraine</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Project name</Label>
            <Input
              disabled={pending}
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="acme-ring"
            />
          </div>
          <div className="space-y-1">
            <Label>Namespace</Label>
            <Input
              disabled={pending}
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              placeholder="ring-acme-org"
            />
          </div>
          <div className="space-y-1">
            <Label>Deployment name</Label>
            <Input
              disabled={pending}
              value={deploymentName}
              onChange={(e) => setDeploymentName(e.target.value)}
              placeholder={namespace || 'deployment'}
            />
          </div>
        </div>
        <Button disabled={pending || !namespace} size="sm" type="button" onClick={save}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save namespace lock
        </Button>
      </CardContent>
    </Card>
  )
}
