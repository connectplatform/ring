'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

type MaskedValue =
  | { set: true; class: 'secret'; owner?: string }
  | { set: true; class: 'public'; value: string; owner?: string }
  | { set: false; class: 'public' | 'secret'; owner?: string }

type Group = {
  id: string
  title: string
  keys: Array<{ key: string; class: 'public' | 'secret'; owner?: string; optional?: boolean }>
}

export function EnvConfigPanel({ orderId }: { orderId: string }) {
  const t = useTranslations('calculator')
  const [pending, startTransition] = useTransition()
  const [envConfig, setEnvConfig] = useState<Record<string, MaskedValue>>({})
  const [groups, setGroups] = useState<Group[]>([])
  const [essentials, setEssentials] = useState<string[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [requesting, setRequesting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const res = await fetch(`/api/my-jobs/${orderId}/deployment`)
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Failed to load deployment')
    setEnvConfig(json.deployment?.envConfig || {})
    setGroups(json.groups || [])
    setEssentials(json.essentials || [])
  }, [orderId])

  useEffect(() => {
    startTransition(() => {
      void load().catch((e) => setError(e instanceof Error ? e.message : 'Load failed'))
    })
  }, [load])

  const essentialKeys = useMemo(() => {
    const set = new Set(essentials)
    return groups.flatMap((g) => g.keys.filter((k) => set.has(k.key)))
  }, [groups, essentials])

  const onSave = () => {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/my-jobs/${orderId}/deployment`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ envConfig: drafts }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Save failed')
        setEnvConfig(json.deployment?.envConfig || {})
        setDrafts({})
        setSaved(true)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Save failed')
      }
    })
  }

  const requestKeys = async (keys: string[]) => {
    setRequesting(keys[0] || 'batch')
    try {
      const docsPath = keys.some((k) => k.includes('FIREBASE'))
        ? '/docs/backend/firebase'
        : keys.some((k) => k.includes('RINGBASE') || k.includes('BLOB'))
          ? '/docs/integrations/ring-filebase'
          : '/docs/backend/firebase'
      const res = await fetch('/api/my-jobs/env-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, keys, docsPath }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Request failed')
      toast({
        title: t('order.lab.requestSent'),
        description: keys.join(', '),
      })
    } catch (e) {
      toast({
        title: t('order.lab.requestFailed'),
        description: e instanceof Error ? e.message : 'Failed',
        variant: 'destructive',
      })
    } finally {
      setRequesting(null)
    }
  }

  const renderKey = (key: string, cls: 'public' | 'secret', owner?: string) => {
    const masked = envConfig[key]
    const isOwnerPrivate = owner === 'owner_private' || masked?.owner === 'owner_private'
    if (isOwnerPrivate) {
      return (
        <div key={key} className="space-y-1">
          <Label className="font-mono text-xs">
            {key}
            <span className="ml-2 text-amber-700 dark:text-amber-400">
              {t('order.lab.ownerPrivate')}
            </span>
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="font-mono text-xs"
              disabled
              placeholder={masked?.set ? '•••••••• (set)' : t('order.lab.missing')}
              type="password"
              value=""
            />
            <Button
              disabled={!!requesting}
              size="sm"
              type="button"
              variant="outline"
              onClick={() => void requestKeys([key])}
            >
              {requesting === key ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              {t('order.lab.requestUpdate')}
            </Button>
          </div>
        </div>
      )
    }

    const placeholder =
      masked?.set && cls === 'secret'
        ? '•••••••• (set)'
        : masked?.set && masked.class === 'public'
          ? masked.value
          : ''
    return (
      <div key={key} className="space-y-1">
        <Label className="font-mono text-xs">
          {key}
          {cls === 'secret' ? (
            <span className="ml-2 text-muted-foreground">{t('order.lab.secret')}</span>
          ) : null}
        </Label>
        <Input
          className="font-mono text-xs"
          disabled={pending}
          placeholder={placeholder || (cls === 'secret' ? t('order.lab.enterSecret') : '')}
          type={cls === 'secret' ? 'password' : 'text'}
          value={drafts[key] ?? ''}
          onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
        />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">{t('order.lab.envTitle')}</CardTitle>
        <Button disabled={pending || Object.keys(drafts).length === 0} size="sm" onClick={onSave}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t('order.lab.saveEnv')}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {saved ? <p className="text-sm text-muted-foreground">{t('order.lab.envSaved')}</p> : null}

        {essentialKeys.length > 0 ? (
          <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
              {t('order.lab.cloneEssentials')}
            </p>
            {essentialKeys.map((k) => renderKey(k.key, k.class, k.owner))}
          </div>
        ) : null}

        <div className="space-y-2">
          {groups.map((g) => (
            <details key={g.id} className="rounded border px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium">{g.title}</summary>
              <div className="mt-3 space-y-3">
                {g.keys
                  .filter((k) => !essentials.includes(k.key))
                  .map((k) => renderKey(k.key, k.class, k.owner))}
              </div>
            </details>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
