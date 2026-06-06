'use client'

import React, { useState } from 'react'
import type { NewsArticle } from '@/features/news/types'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'
import { toNewsDate } from '@/lib/news/news-dates'

interface NewsPromotionPanelProps {
  article: NewsArticle
}

export function NewsPromotionPanel({ article }: NewsPromotionPanelProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submitPromotion = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/news/promotion/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: article.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Submit failed')
      if (json.paymentUrl) {
        window.location.href = json.paymentUrl
        return
      }
      window.location.reload()
    } catch (e: any) {
      setError(e?.message ?? 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border border-border p-4 space-y-3 mt-4">
      <div className="flex items-center justify-between">
        <Label htmlFor={`promo-${article.id}`}>Publish on main page (paid)</Label>
        <Switch
          id={`promo-${article.id}`}
          checked={Boolean(article.promoteToMainPage)}
          disabled
        />
      </div>
      {article.mainPageStatus && (
        <Badge variant="secondary">Status: {article.mainPageStatus}</Badge>
      )}
      {article.mainPageStatusHistory && article.mainPageStatusHistory.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-1">
          {article.mainPageStatusHistory.map((h, i) => (
            <li key={i}>
              {h.status} — {formatDistanceToNow(toNewsDate(h.at), { addSuffix: true })}
              {h.note ? ` (${h.note})` : ''}
            </li>
          ))}
        </ul>
      )}
      {article.aiScore && (
        <p className="text-xs text-muted-foreground">
          Ethics {(article.aiScore.ethics * 100).toFixed(0)}% · Spam{' '}
          {(article.aiScore.spamRisk * 100).toFixed(0)}% · Merit{' '}
          {(article.aiScore.merit * 100).toFixed(0)}% ·{' '}
          {article.aiScore.suggestedPriceUah} UAH
        </p>
      )}
      {article.mainPageStatus !== 'published_main' &&
        article.mainPageStatus !== 'awaiting_admin_approval' && (
          <Button size="sm" onClick={submitPromotion} disabled={loading}>
            {loading ? 'Processing…' : 'Request main-page promotion'}
          </Button>
        )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
