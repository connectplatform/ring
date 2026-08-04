'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import { Avatar } from '@/components/ui/avatar'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import type { ProjectOrder } from '@/features/crm/orders/types'
import type { CrmUserChip } from '@/features/crm/orders/resolve-users'
import { MessageUserButton } from '@/features/auth/components/message-user-button'
import { fetchJsonSafe } from '@/features/crm/lab/safe-fetch-json'
import { Loader2 } from 'lucide-react'

function nicheTitle(order: ProjectOrder): string {
  return order.snapshot?.inputs?.niche?.trim() || order.id
}

export function MyJobDetailClient({
  order: initial,
  buyer,
  locale,
  hidePageTitle = false,
}: {
  order: ProjectOrder
  buyer: CrmUserChip | null
  locale: Locale
  hidePageTitle?: boolean
}) {
  const t = useTranslations('calculator')
  const router = useRouter()
  const [order, setOrder] = useState(initial)
  const [progress, setProgress] = useState(initial.progress)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showFullBrief, setShowFullBrief] = useState(false)

  const patch = (body: Record<string, unknown>) => {
    setError(null)
    startTransition(async () => {
      const { ok, data, error: parseErr } = await fetchJsonSafe<{
        error?: string
        order?: ProjectOrder
      }>(`/api/my-jobs/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!ok || !data?.order) {
        setError(parseErr || data?.error || t('order.updateFailed'))
        return
      }
      setOrder(data.order)
      setProgress(data.order.progress)
      router.refresh()
    })
  }

  const snap = order.snapshot
  const results = snap?.results
  const inputs = snap?.inputs
  const locked =
    order.workStatus === 'canceled' || order.workStatus === 'completed'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button asChild size="sm" variant="ghost">
            <Link href={ROUTES.MY_JOBS(locale)}>{t('order.backToDesk')}</Link>
          </Button>
          {!hidePageTitle ? (
            <>
              <h1 className="text-2xl font-bold">{nicheTitle(order)}</h1>
              <p className="text-sm text-muted-foreground">{order.id}</p>
            </>
          ) : (
            <p className="font-mono text-xs text-muted-foreground">{order.id}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{order.paymentStatus}</Badge>
          <Badge>{order.workStatus}</Badge>
        </div>
      </div>

      {buyer ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('order.client')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Avatar
                className="h-10 w-10"
                fallback={buyer.name.slice(0, 2).toUpperCase()}
                size="sm"
                src={buyer.photoURL}
              />
              <div className="min-w-0">
                <p className="truncate font-medium">{buyer.name}</p>
                {buyer.email ? (
                  <p className="truncate text-xs text-muted-foreground">{buyer.email}</p>
                ) : null}
              </div>
            </div>
            <MessageUserButton
              locale={locale}
              targetUserId={buyer.id}
              targetUserName={buyer.name}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('order.scopeBrief')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <dl className="grid gap-2 sm:grid-cols-2">
            {inputs?.niche ? (
              <>
                <dt className="text-muted-foreground">{t('order.briefNiche')}</dt>
                <dd>{inputs.niche}</dd>
              </>
            ) : null}
            {inputs?.hosting ? (
              <>
                <dt className="text-muted-foreground">{t('order.briefHosting')}</dt>
                <dd>{String(inputs.hosting)}</dd>
              </>
            ) : null}
            {results?.complexity != null ? (
              <>
                <dt className="text-muted-foreground">{t('order.briefComplexity')}</dt>
                <dd>
                  {results.complexity}
                  {results.customizationComplexity != null
                    ? ` (${results.customizationComplexity}%)`
                    : ''}
                </dd>
              </>
            ) : null}
            {results?.estimatedHours != null ? (
              <>
                <dt className="text-muted-foreground">{t('order.briefHours')}</dt>
                <dd>{results.estimatedHours}</dd>
              </>
            ) : null}
            {results?.oneTimeFiat != null ? (
              <>
                <dt className="text-muted-foreground">{t('order.briefOneTime')}</dt>
                <dd>
                  {results.oneTimeFiat} {snap?.rates?.mainCurrency ?? order.currency}
                </dd>
              </>
            ) : null}
            {results?.monthlyFiat != null ? (
              <>
                <dt className="text-muted-foreground">{t('order.briefMonthly')}</dt>
                <dd>
                  {results.monthlyFiat} {snap?.rates?.mainCurrency ?? order.currency}
                </dd>
              </>
            ) : null}
          </dl>
          <Button
            size="sm"
            type="button"
            variant="outline"
            onClick={() => setShowFullBrief((v) => !v)}
          >
            {showFullBrief ? t('order.hideFullBrief') : t('order.showFullBrief')}
          </Button>
          {showFullBrief ? (
            <pre className="whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-xs">
              {order.details}
            </pre>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('order.nextActions')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>
              {t('order.progressLabel', { progress })}
            </Label>
            <Progress value={progress} />
            <Slider
              disabled={pending || locked}
              max={100}
              min={0}
              step={1}
              value={[progress]}
              onValueChange={(v) => setProgress(v[0] ?? 0)}
            />
            <div className="flex flex-wrap gap-2">
              {order.workStatus !== 'in_progress' && !locked ? (
                <Button
                  disabled={pending}
                  variant="secondary"
                  onClick={() => patch({ workStatus: 'in_progress' })}
                >
                  {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {t('order.startWork')}
                </Button>
              ) : null}
              <Button
                disabled={pending || locked}
                onClick={() => patch({ progress })}
                variant="secondary"
              >
                {t('order.saveProgress')}
              </Button>
              <Button
                disabled={pending || locked}
                onClick={() => patch({ workStatus: 'completed', progress: 100 })}
              >
                {t('order.markComplete')}
              </Button>
              <Button
                disabled={pending || order.workStatus === 'canceled'}
                variant="destructive"
                onClick={() => {
                  if (window.confirm(t('order.confirmDispute'))) {
                    patch({ workStatus: 'disputed' })
                  }
                }}
              >
                {t('order.flagDispute')}
              </Button>
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <p className="text-xs text-muted-foreground">
            {t('order.updatedAt', { date: new Date(order.updatedAt).toLocaleString(locale) })}
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {order.opportunityId ? (
          <Button asChild variant="outline">
            <Link href={ROUTES.OPPORTUNITY(order.opportunityId, locale)}>
              {t('order.viewOpportunity')}
            </Link>
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <Link href={ROUTES.MY_JOBS(locale)}>{t('order.backToDesk')}</Link>
        </Button>
      </div>
    </div>
  )
}
