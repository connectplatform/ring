'use client'

import React from 'react'
import type { NewsArticle } from '@/features/news/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { toNewsDate } from '@/lib/news/news-dates'

interface NewsSubmissionsReadyProps {
  articles: NewsArticle[]
  locale: string
}

export function NewsSubmissionsReady({ articles, locale }: NewsSubmissionsReadyProps) {
  const paidQueue = articles.filter(
    (a) => a.mainPageStatus === 'awaiting_admin_approval' && a.payment?.paidAt
  )
  const unpaidPopular = articles.filter((a) => {
    if (a.mainPageStatus === 'awaiting_admin_approval' && a.payment?.paidAt) return false
    const merit = a.aiScore?.merit ?? 0
    const views = a.views ?? 0
    const threshold = Number(process.env.NEXT_PUBLIC_NEWS_UNPAID_VIEWS ?? 100)
    return (
      a.promoteToMainPage &&
      (merit >= 0.7 || views >= threshold) &&
      a.mainPageStatus !== 'published_main' &&
      a.mainPageStatus !== 'rejected'
    )
  })

  const renderRow = (article: NewsArticle) => (
    <div
      key={article.id}
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-b border-border last:border-0"
    >
      <div className="min-w-0">
        <p className="font-medium truncate">{article.title}</p>
        <p className="text-sm text-muted-foreground">
          {article.authorName} · {article.mainPageStatus} ·{' '}
          {article.aiScore?.merit != null ? `merit ${(article.aiScore.merit * 100).toFixed(0)}%` : ''}
          {article.payment?.paidAt ? ' · paid' : ' · unpaid'}
        </p>
        {article.mainPageStatusHistory && article.mainPageStatusHistory.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            Last: {article.mainPageStatusHistory[article.mainPageStatusHistory.length - 1]?.status}{' '}
            {formatDistanceToNow(
              toNewsDate(article.mainPageStatusHistory[article.mainPageStatusHistory.length - 1]?.at),
              { addSuffix: true }
            )}
          </p>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        <Badge variant="outline">{article.payment?.amount ?? article.aiScore?.suggestedPriceUah ?? '—'} UAH</Badge>
        <Button size="sm" variant="outline" asChild>
          <Link href={`/${locale}/admin/news/edit/${article.id}`}>Review</Link>
        </Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6 mb-8">
      <Card>
        <CardHeader>
          <CardTitle>Submissions ready for publication</CardTitle>
          <p className="text-sm text-muted-foreground">
            Paid submissions awaiting admin approval (Telegram notifications sent per article).
          </p>
        </CardHeader>
        <CardContent>
          {paidQueue.length === 0 ? (
            <p className="text-sm text-muted-foreground">No paid submissions in queue.</p>
          ) : (
            paidQueue.map(renderRow)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Unpaid — high merit / popular</CardTitle>
        </CardHeader>
        <CardContent>
          {unpaidPopular.length === 0 ? (
            <p className="text-sm text-muted-foreground">None flagged.</p>
          ) : (
            unpaidPopular.map(renderRow)
          )}
        </CardContent>
      </Card>
    </div>
  )
}
