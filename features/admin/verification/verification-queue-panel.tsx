'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { RefreshCw, ShieldCheck, Check, X, MessageSquare } from 'lucide-react'
import type { VerificationQueueItem } from '@/features/verification/services/get-verification-queue'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'

export default function VerificationQueuePanel({ locale }: { locale: Locale }) {
  const t = useTranslations('modules.admin.verificationQueue')
  const [items, setItems] = useState<VerificationQueueItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [actionNote, setActionNote] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/admin/verification/queue', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load verification queue')
      }
      setItems(data.queue ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load verification queue')
    }
  }, [])

  useEffect(() => {
    startTransition(() => {
      void load()
    })
  }, [load])

  const runAction = async (
    procedureNumber: string,
    action: 'approve' | 'reject' | 'request-info' | 'under-review',
  ) => {
    setError(null)
    const note = actionNote[procedureNumber] ?? ''
    if (action === 'reject' && !note.trim()) {
      setError(t('rejectReasonRequired'))
      return
    }
    if (action === 'request-info' && !note.trim()) {
      setError(t('requestInfoNoteRequired'))
      return
    }

    try {
      const body =
        action === 'reject'
          ? { rejectionReason: note }
          : action === 'request-info'
            ? { note }
            : {}

      const res = await fetch(
        `/api/admin/verification/procedures/${encodeURIComponent(procedureNumber)}/${action}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || t('actionFailed'))
      }
      setActionNote((prev) => ({ ...prev, [procedureNumber]: '' }))
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('actionFailed'))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
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
        <Card key={item.procedureNumber}>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-mono">{item.procedureNumber}</CardTitle>
                <CardDescription>
                  {item.entityName || item.subjectId} · {t('subjectType', { type: item.subjectType })}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{item.status}</Badge>
                <Badge variant="secondary">
                  {t('documentCount', { count: item.documentCount })}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>{t('applicant', { id: item.applicantUserId })}</p>
              {item.submittedAt && (
                <p>{t('submittedAt', { at: new Date(item.submittedAt).toLocaleString() })}</p>
              )}
              {item.subjectType === 'entity_identity' && (
                <p>
                  <Link href={ROUTES.ENTITY(item.subjectId, locale)} className="text-primary hover:underline">
                    {t('viewEntity')}
                  </Link>
                </p>
              )}
            </div>

            <Input
              placeholder={t('notePlaceholder')}
              value={actionNote[item.procedureNumber] ?? ''}
              onChange={(e) =>
                setActionNote((prev) => ({ ...prev, [item.procedureNumber]: e.target.value }))
              }
            />

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="default" onClick={() => runAction(item.procedureNumber, 'approve')}>
                <Check className="w-3 h-3 mr-1" />
                {t('approve')}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => runAction(item.procedureNumber, 'reject')}>
                <X className="w-3 h-3 mr-1" />
                {t('reject')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => runAction(item.procedureNumber, 'request-info')}
              >
                <MessageSquare className="w-3 h-3 mr-1" />
                {t('requestInfo')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
