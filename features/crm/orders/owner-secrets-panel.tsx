'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ExternalLink, KeyRound } from 'lucide-react'

type MaskedValue =
  | { set: true; class: 'secret' | 'public'; owner?: string; value?: string }
  | { set: false; class: 'public' | 'secret'; owner?: string }

type Group = {
  id: string
  title: string
  keys: Array<{ key: string; class: 'public' | 'secret'; owner?: string }>
}

/**
 * Buyer Owner Secrets — Firebase / RingBase / public_shared keys only.
 */
export function OwnerSecretsPanel({ orderId }: { orderId: string }) {
  const t = useTranslations('calculator')
  const [pending, startTransition] = useTransition()
  const [envConfig, setEnvConfig] = useState<Record<string, MaskedValue>>({})
  const [groups, setGroups] = useState<Group[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [readOnly, setReadOnly] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/my-orders/${orderId}/env`)
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Failed to load secrets')
    setEnvConfig(json.envConfig || {})
    setGroups(json.groups || [])
    setReadOnly(Boolean(json.readOnly))
  }, [orderId])

  useEffect(() => {
    startTransition(() => {
      void load().catch((e) => setError(e instanceof Error ? e.message : 'Load failed'))
    })
  }, [load])

  const onSave = () => {
    if (readOnly) return
    setError(null)
    setSaved(false)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/my-orders/${orderId}/env`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ envConfig: drafts }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Save failed')
        setEnvConfig(json.envConfig || {})
        setDrafts({})
        setSaved(true)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Save failed')
      }
    })
  }

  return (
    <Card id="secrets">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" />
          {t('order.secrets.title')}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {readOnly
            ? t('order.secrets.readOnlySubtitle', {
                defaultValue: 'Owner secrets — ask buyer to fill).',
              })
            : t('order.secrets.subtitle')}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm" variant="outline">
            <Link href="/docs/backend/firebase">
              <ExternalLink className="mr-1 h-3 w-3" />
              Firebase
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/docs/integrations/ring-filebase">
              <ExternalLink className="mr-1 h-3 w-3" />
              Ring Filebase
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {saved ? (
          <p className="text-sm text-muted-foreground">{t('order.secrets.savedBanner')}</p>
        ) : null}
        {groups.map((g) => (
          <div key={g.id} className="space-y-3">
            <h3 className="text-sm font-medium">{g.title}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {g.keys.map((k) => {
                const masked = envConfig[k.key]
                const placeholder =
                  masked?.set && (k.class === 'secret' || masked.class === 'secret')
                    ? '•••••••• (set)'
                    : masked?.set && 'value' in masked
                      ? String(masked.value)
                      : ''
                return (
                  <div key={k.key} className="space-y-1">
                    <Label className="font-mono text-xs">{k.key}</Label>
                    <Input
                      className="font-mono text-xs"
                      disabled={pending || readOnly}
                      placeholder={placeholder}
                      type={k.class === 'secret' ? 'password' : 'text'}
                      value={drafts[k.key] ?? ''}
                      onChange={(e) => setDrafts((d) => ({ ...d, [k.key]: e.target.value }))}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        {!readOnly ? (
          <Button
            disabled={pending || Object.keys(drafts).length === 0}
            size="sm"
            type="button"
            onClick={onSave}
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t('order.secrets.save')}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
