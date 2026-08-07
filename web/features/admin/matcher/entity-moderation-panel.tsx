'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RefreshCw, ShieldAlert, Ban } from 'lucide-react'
import type { EntityModerationQueueItem } from '@/features/admin/matcher/get-entity-moderation-queue'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'

export default function EntityModerationPanel({ locale }: { locale: Locale }) {
  const t = useTranslations('modules.admin.matcherModeration')
  const [items, setItems] = useState<EntityModerationQueueItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/admin/entity-moderation', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load')
      }
      setItems(data.items ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load moderation queue')
    }
  }, [])

  useEffect(() => {
    startTransition(() => {
      void load()
    })
  }, [load])

  const handleBlock = async (entityId: string) => {
    if (!confirm(t('confirmBlock'))) return
    try {
      const res = await fetch('/api/admin/entity-moderation/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId, reason: t('adminBlockReason') }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Block failed')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Block failed')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ShieldAlert className="w-5 h-5" />
            {t('title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => startTransition(() => void load())} disabled={isPending}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isPending ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {items.length === 0 && !isPending && !error && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">{t('empty')}</CardContent>
        </Card>
      )}

      {items.map((item) => (
        <Card key={item.entityId}>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg">
                  <Link href={ROUTES.ENTITY(item.entityId, locale)} className="hover:underline">
                    {item.entityName}
                  </Link>
                </CardTitle>
                <CardDescription className="font-mono text-xs">{item.entityId}</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  {t('reportCount', { count: item.reportCount })}
                </Badge>
                <Badge variant={item.moderationStatus === 'blocked' ? 'destructive' : 'outline'}>
                  {item.moderationStatus}
                </Badge>
                {item.moderationStatus !== 'blocked' && (
                  <Button size="sm" variant="destructive" onClick={() => handleBlock(item.entityId)}>
                    <Ban className="w-3 h-3 mr-1" />
                    {t('blockGlobally')}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {item.reports.map((report) => (
              <div key={report.id} className="rounded-md border p-3 text-sm space-y-1">
                <div className="flex flex-wrap gap-2 items-center">
                  <Badge variant="outline">{report.category}</Badge>
                  <span className="text-muted-foreground text-xs">
                    {new Date(report.createdAt).toLocaleString()}
                  </span>
                  <span className="text-muted-foreground text-xs font-mono">
                    {t('reporter', { id: report.reporterUserId })}
                  </span>
                </div>
                <p>{report.reason}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
