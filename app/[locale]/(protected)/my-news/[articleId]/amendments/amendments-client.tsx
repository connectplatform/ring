'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RevisionHunkPreview } from '@/features/news/components/revision-hunk-preview'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import type { NewsRevision } from '@/features/news/types/collaboration'
import { Check, X, Loader2, ArrowLeft } from 'lucide-react'

type AmendmentsClientProps = {
  locale: Locale
  articleId: string
  articleTitle: string
  revisions: NewsRevision[]
  selected?: NewsRevision | null
  canResolve: boolean
}

export function AmendmentsClient({
  locale,
  articleId,
  articleTitle,
  revisions,
  selected,
  canResolve,
}: AmendmentsClientProps) {
  const t = useTranslations('news')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const active = selected || revisions[0] || null

  const resolve = (action: 'accept' | 'reject') => {
    if (!active) return
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/news/revisions/${active.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        })
        const data = await res.json()
        if (!res.ok || !data.success) {
          setError(data.error || t('amendments.errorResolve'))
          return
        }
        router.push(ROUTES.MY_NEWS(locale))
        router.refresh()
      } catch {
        setError(t('amendments.errorNetwork'))
      }
    })
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href={ROUTES.MY_NEWS(locale)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('amendments.backToMyNews')}
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">{t('amendments.pageTitle')}</h1>
          <p className="text-muted-foreground">{articleTitle}</p>
        </div>
        <Badge variant="secondary">
          {t('amendments.pendingCount', { count: revisions.length })}
        </Badge>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {revisions.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {t('amendments.empty')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('amendments.revisions')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {revisions.map((rev) => (
                <Button
                  key={rev.id}
                  variant={active?.id === rev.id ? 'default' : 'outline'}
                  size="sm"
                  className="h-auto w-full flex-col items-start py-2"
                  asChild
                >
                  <Link href={ROUTES.MY_NEWS_AMENDMENT_PREVIEW(articleId, rev.id, locale)}>
                    <span className="font-medium">{rev.proposerName}</span>
                    <span className="text-xs opacity-80">
                      +{rev.diffSummary?.added ?? 0} / −{rev.diffSummary?.removed ?? 0}
                    </span>
                  </Link>
                </Button>
              ))}
            </CardContent>
          </Card>

          {active ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <div>
                  <CardTitle className="text-base">
                    {t('amendments.fromAuthor', { name: active.proposerName })}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {new Date(active.createdAt).toLocaleString(locale)}
                  </p>
                </div>
                {canResolve ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => resolve('accept')}
                      disabled={pending}
                      className="bg-green-700 hover:bg-green-800"
                    >
                      {pending ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="mr-1 h-4 w-4" />
                      )}
                      {t('amendments.accept')}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => resolve('reject')}
                      disabled={pending}
                    >
                      <X className="mr-1 h-4 w-4" />
                      {t('amendments.reject')}
                    </Button>
                  </div>
                ) : null}
              </CardHeader>
              <CardContent>
                <RevisionHunkPreview
                  baseContent={active.baseContent}
                  proposedContent={active.proposedContent}
                  emptyLabel={t('amendments.noDiff')}
                />
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  )
}
