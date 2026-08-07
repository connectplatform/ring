'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Check, Copy, Share2, Sparkles, Users } from 'lucide-react'
import type { RefcodeRecord, ReferralRewardRecord } from '@/features/refcodes/types'
import {
  appendReferralFragment,
  buildUsernameShareUrl,
} from '@/features/refcodes/lib/referral-share-url'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES } from '@/constants/routes'
import { getPolygonscanUrl } from '@/constants/web3'
import type { Locale } from '@/i18n/shared'
import { davinciGlassSurface } from '@/lib/ui/davinci'
import { cn } from '@/lib/utils'

type DashboardData = {
  codes: RefcodeRecord[]
  rewards: Array<ReferralRewardRecord & { id: string }>
  tokenSymbol: string
  creditUnitLabel?: string
  primaryTag?: string | null
  username?: string | null
  stats: {
    totalRewards: number
    minted: number
    pending: number
    processing: number
    totalEarned: number
    signupCount?: number
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
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [origin, setOrigin] = useState('')

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

  useEffect(() => {
    setOrigin(typeof window !== 'undefined' ? window.location.origin : '')
  }, [])

  const primaryTag = data?.primaryTag || data?.username || null
  const creditUnit = data?.creditUnitLabel || 'points'

  const homeShareUrl =
    origin && primaryTag
      ? buildUsernameShareUrl({
          origin,
          locale,
          username: primaryTag,
        })
      : ''

  const copyText = async (key: string, text: string) => {
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const copyCurrentPage = async () => {
    if (!primaryTag || typeof window === 'undefined') return
    const tagged = appendReferralFragment(window.location.href, primaryTag)
    await copyText('page', tagged)
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

  const usernameCodes = data.codes.filter((c) => c.kind === 'username' || c.code === primaryTag)
  const otherCodes = data.codes.filter((c) => !usernameCodes.some((u) => u.code === c.code))

  return (
    <div className="space-y-8">
      <section
        className={cn(
          davinciGlassSurface,
          'space-y-3 p-5 sm:p-6',
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklch,var(--davinci-beam)_16%,transparent)] text-[var(--davinci-beam)]">
            <Sparkles className="size-5" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 space-y-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t('heroTerms', { unit: creditUnit })}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t('heroCommission', { unit: creditUnit })}
            </p>
          </div>
        </div>
      </section>

      {!primaryTag ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <p className="text-muted-foreground">{t('needUsername')}</p>
            <Button asChild>
              <Link href={ROUTES.PROFILE(locale as Locale)}>{t('setUsernameCta')}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{t('yourTag')}</h2>
          <Card>
            <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-mono text-sm font-medium">#{primaryTag}</p>
                <p className="break-all text-xs text-muted-foreground">{homeShareUrl}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t('tagHint')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void copyText('home', homeShareUrl)}
                >
                  {copiedKey === 'home' ? (
                    <Check className="mr-1 h-4 w-4" />
                  ) : (
                    <Copy className="mr-1 h-4 w-4" />
                  )}
                  {copiedKey === 'home' ? t('copied') : t('copyLink')}
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => void copyCurrentPage()}>
                  {copiedKey === 'page' ? (
                    <Check className="mr-1 h-4 w-4" />
                  ) : (
                    <Copy className="mr-1 h-4 w-4" />
                  )}
                  {copiedKey === 'page' ? t('copied') : t('copyThisPage')}
                </Button>
                {typeof navigator !== 'undefined' && navigator.share ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      void navigator.share({
                        title: t('shareTitle'),
                        text: t('shareText'),
                        url: homeShareUrl,
                      })
                    }
                  >
                    <Share2 className="mr-1 h-4 w-4" />
                    {t('share')}
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('stats.earnedCredits', { unit: creditUnit })}</CardDescription>
            <CardTitle>
              {data.stats.totalEarned.toFixed(2)} {creditUnit}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('stats.signups')}</CardDescription>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5 text-muted-foreground" />
              {data.stats.signupCount ?? 0}
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
      </div>

      {data.stats.visitStats && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t('visitsTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('visitsExplainer')}</p>
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

      {(usernameCodes.length > 0 || otherCodes.length > 0) && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{t('yourLinks')}</h2>
          {[...usernameCodes, ...otherCodes].map((code) => {
            const share =
              origin && code.kind === 'username'
                ? buildUsernameShareUrl({ origin, locale, username: code.code })
                : origin
                  ? appendReferralFragment(
                      `${origin}${locale === 'en' ? '' : `/${locale}`}/`,
                      primaryTag || code.code,
                    )
                  : ''
            return (
              <Card key={code.code}>
                <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-mono text-sm font-medium">
                      {code.kind === 'username' ? `#${code.code}` : code.code}
                    </p>
                    <p className="break-all text-xs text-muted-foreground">{share}</p>
                    {code.visitStats ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t('linkVisits', { count: code.visitStats.total })}
                        {code.visitStats.today > 0 && (
                          <> · {t('linkVisitsToday', { count: code.visitStats.today })}</>
                        )}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void copyText(code.code, share)}
                  >
                    {copiedKey === code.code ? (
                      <Check className="mr-1 h-4 w-4" />
                    ) : (
                      <Copy className="mr-1 h-4 w-4" />
                    )}
                    {copiedKey === code.code ? t('copied') : t('copyLink')}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </section>
      )}

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
                  +{reward.rewardAmount}{' '}
                  {reward.displayUnit === 'credit_balance' || !reward.txHash
                    ? creditUnit
                    : data.tokenSymbol}{' '}
                  · {statusLabel(reward.status)}
                </span>
                {reward.txHash ? (
                  <a
                    href={getPolygonscanUrl(reward.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    {t('viewTx')}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
