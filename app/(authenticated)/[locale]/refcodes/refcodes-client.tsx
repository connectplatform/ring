'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Check, Copy, Share2 } from 'lucide-react'
import type { RefcodeRecord, ReferralRewardRecord } from '@/features/refcodes/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES } from '@/constants/routes'
import { getPolygonscanUrl } from '@/constants/web3'
import type { Locale } from '@/i18n/shared'

type DashboardData = {
  codes: RefcodeRecord[]
  rewards: Array<ReferralRewardRecord & { id: string }>
  tokenSymbol: string
  stats: {
    totalRewards: number
    minted: number
    pending: number
    processing: number
    totalEarned: number
    visitStats: {
      total: number
      today: number
      last7d: number
      last28d: number
    }
  }
}

export default function RefcodesClient({ locale }: { locale: string }) {
  const t = useTranslations('modules.refcodes')
  const [data, setData] = useState<DashboardData | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/refcodes')
      .then((r) => r.json())
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const shareUrl = useCallback(
    (code: string) => {
      if (typeof window === 'undefined') return ''
      const origin = window.location.origin
      const prefix = locale === 'en' ? '' : `/${locale}`
      return `${origin}${prefix}/?ref=${encodeURIComponent(code)}`
    },
    [locale]
  )

  const copyLink = async (code: string) => {
    const url = shareUrl(code)
    await navigator.clipboard.writeText(url)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const statusLabel = (status: string) => {
    try {
      return t(`status.${status}` as 'status.minted')
    } catch {
      return status
    }
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">{t('loadError')}</p>
        <Button type="button" variant="outline" onClick={load}>
          {t('retry')}
        </Button>
      </div>
    )
  }

  const tokenSymbol = data.tokenSymbol || 'RING'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('explainer')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('stats.earned', { token: tokenSymbol })}</CardDescription>
            <CardTitle>
              {data.stats.totalEarned.toFixed(2)} {tokenSymbol}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('stats.minted')}</CardDescription>
            <CardTitle>{data.stats.minted}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('stats.pending')}</CardDescription>
            <CardTitle>{data.stats.pending}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('stats.processing')}</CardDescription>
            <CardTitle>{data.stats.processing}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {data.stats.visitStats && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t('visitsTitle')}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{t('stats.visitsTotal')}</CardDescription>
                <CardTitle>{data.stats.visitStats.total}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{t('stats.visitsToday')}</CardDescription>
                <CardTitle>{data.stats.visitStats.today}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{t('stats.visits7d')}</CardDescription>
                <CardTitle>{data.stats.visitStats.last7d}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{t('stats.visits28d')}</CardDescription>
                <CardTitle>{data.stats.visitStats.last28d}</CardTitle>
              </CardHeader>
            </Card>
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t('yourLinks')}</h2>
        {data.codes.length === 0 ? (
          <Card>
            <CardContent className="space-y-4 pt-6">
              <p className="text-muted-foreground">{t('noWallets')}</p>
              <Button asChild>
                <Link href={ROUTES.WALLET(locale as Locale)}>{t('connectWallet')}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          data.codes.map((code) => (
            <Card key={code.code}>
              <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-mono text-sm font-medium">{code.code}</p>
                  <p className="text-xs text-muted-foreground break-all">{shareUrl(code.code)}</p>
                  {code.visitStats && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('linkVisits', { count: code.visitStats.total })}
                      {code.visitStats.today > 0 && (
                        <> · {t('linkVisitsToday', { count: code.visitStats.today })}</>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyLink(code.code)}
                  >
                    {copiedCode === code.code ? (
                      <Check className="mr-1 h-4 w-4" />
                    ) : (
                      <Copy className="mr-1 h-4 w-4" />
                    )}
                    {copiedCode === code.code ? t('copied') : t('copyLink')}
                  </Button>
                  {typeof navigator !== 'undefined' && navigator.share && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        navigator.share({
                          title: t('shareTitle'),
                          text: t('shareText'),
                          url: shareUrl(code.code),
                        })
                      }
                    >
                      <Share2 className="mr-1 h-4 w-4" />
                      {t('share')}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      {data.rewards.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{t('history')}</h2>
          <ul className="space-y-2 text-sm">
            {data.rewards.slice(0, 25).map((reward) => (
              <li
                key={reward.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <span>
                  +{reward.rewardAmount} {tokenSymbol} · {statusLabel(reward.status)}
                </span>
                {reward.txHash && (
                  <a
                    href={getPolygonscanUrl(reward.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    {t('viewTx')}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
