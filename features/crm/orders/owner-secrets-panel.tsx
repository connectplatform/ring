'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ExternalLink, KeyRound } from 'lucide-react'
import { fetchJsonSafe } from '@/features/crm/lab/safe-fetch-json'
import { labFieldClassName, toneForEmpty } from '@/features/crm/lab/lab-field-tone'
import { useOptionalOrderLabTabStatus } from '@/features/crm/lab/order-lab-tab-status-context'
import { ENV_ESSENTIALS } from '@/features/crm/lab/env-essentials'
import { getEnvKeyOwner } from '@/features/crm/lab/env-key-ownership'

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
  const tabStatus = useOptionalOrderLabTabStatus()
  const [pending, startTransition] = useTransition()
  const [envConfig, setEnvConfig] = useState<Record<string, MaskedValue>>({})
  const [groups, setGroups] = useState<Group[]>([])
  const [essentials, setEssentials] = useState<string[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [readOnly, setReadOnly] = useState(false)

  const bumpSecretsTab = useCallback(
    (nextEnv: Record<string, MaskedValue>, nextDrafts: Record<string, string> = {}) => {
      if (!tabStatus) return
      const flat: Record<string, string> = {}
      for (const [k, v] of Object.entries(nextEnv)) {
        if (v?.set) flat[k] = 'set'
      }
      for (const [k, v] of Object.entries(nextDrafts)) {
        if (v.trim()) flat[k] = v
      }
      const missingRequired = ENV_ESSENTIALS.filter((k) => {
        const owner = getEnvKeyOwner(k)
        if (owner !== 'owner_private' && owner !== 'public_shared') return false
        return !flat[k]
      })
      tabStatus.setTabStatus('secrets', {
        status: missingRequired.length > 0 ? 'error' : 'ok',
        missingRequired,
        missingRecommended: [],
        errors: [],
      })
    },
    [tabStatus],
  )

  const load = useCallback(async () => {
    const { ok, data, error: parseErr } = await fetchJsonSafe<{
      error?: string
      envConfig?: Record<string, MaskedValue>
      groups?: Group[]
      essentials?: string[]
      readOnly?: boolean
    }>(`/api/my-orders/${orderId}/env`)
    if (!ok || !data) throw new Error(parseErr || data?.error || 'Failed to load secrets')
    if (data.error) throw new Error(data.error)
    const next = data.envConfig || {}
    setEnvConfig(next)
    setGroups(data.groups || [])
    setEssentials(data.essentials || [])
    setReadOnly(Boolean(data.readOnly))
    bumpSecretsTab(next)
  }, [bumpSecretsTab, orderId])

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
        const { ok, data, error: parseErr } = await fetchJsonSafe<{
          error?: string
          envConfig?: Record<string, MaskedValue>
        }>(`/api/my-orders/${orderId}/env`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ envConfig: drafts }),
        })
        if (!ok || !data) throw new Error(parseErr || data?.error || 'Save failed')
        if (data.error) throw new Error(data.error)
        const next = data.envConfig || {}
        setEnvConfig(next)
        setDrafts({})
        setSaved(true)
        bumpSecretsTab(next)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Save failed')
        tabStatus?.markTabError('secrets', e instanceof Error ? e.message : 'save_failed')
      }
    })
  }

  const essentialSet = new Set(essentials)

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
                defaultValue: 'Owner secrets — ask buyer to fill.',
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
                const draftVal = drafts[k.key] ?? ''
                const empty = !draftVal.trim() && !masked?.set
                const isEssential = essentialSet.has(k.key)
                const tone = toneForEmpty({
                  empty,
                  required: isEssential,
                  recommended: !isEssential && empty,
                })
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
                      className={labFieldClassName(tone, 'font-mono text-xs')}
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
