'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { ReferralRewardRecord } from '@/features/refcodes/types'
import { approveReferralReward, rejectReferralReward } from '@/app/_actions/admin-refcodes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getPolygonscanUrl, getReferralRewardTokenSymbol } from '@/constants/web3'

type PendingReward = ReferralRewardRecord & { id: string }

type AdminStats = {
  totalCodes: number
  totalRewards: number
  pendingApproval: number
  approved: number
  minting: number
  minted: number
  failed: number
  rejected: number
  totalMintedTokens: number
  visitStats: {
    total: number
    today: number
    last7d: number
    last28d: number
  }
}

export default function AdminRefcodesClient({
  pending,
  recent,
  failed,
  stats,
}: {
  pending: PendingReward[]
  recent: PendingReward[]
  failed: PendingReward[]
  stats: AdminStats
}) {
  const t = useTranslations('modules.refcodes.admin')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const tokenSymbol = getReferralRewardTokenSymbol()

  const refresh = () => router.refresh()

  const handleApprove = (rewardId: string) => {
    startTransition(async () => {
      setMessage(null)
      const fd = new FormData()
      fd.set('rewardId', rewardId)
      const result = await approveReferralReward(fd)
      if (result.success) {
        setMessage({ type: 'success', text: t('approveSuccess') })
        refresh()
      } else {
        setMessage({ type: 'error', text: result.error || t('approveFailed') })
      }
    })
  }

  const handleReject = (rewardId: string) => {
    startTransition(async () => {
      setMessage(null)
      const fd = new FormData()
      fd.set('rewardId', rewardId)
      const result = await rejectReferralReward(fd)
      if (result.success) {
        setMessage({ type: 'success', text: t('rejectSuccess') })
        refresh()
      } else {
        setMessage({ type: 'error', text: result.error || t('rejectFailed') })
      }
    })
  }

  const handleRetryMint = (rewardId: string) => {
    startTransition(async () => {
      setMessage(null)
      try {
        const res = await fetch('/api/refcodes/mint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rewardId }),
        })
        const json = await res.json()
        if (json.success) {
          setMessage({ type: 'success', text: t('mintSuccess') })
          refresh()
        } else {
          setMessage({ type: 'error', text: json.error || t('mintFailed') })
        }
      } catch {
        setMessage({ type: 'error', text: t('mintFailed') })
      }
    })
  }

  const handleBatchMint = () => {
    startTransition(async () => {
      setMessage(null)
      try {
        const res = await fetch('/api/refcodes/mint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit: 20 }),
        })
        const json = await res.json()
        if (json.success) {
          setMessage({
            type: 'success',
            text: t('batchMintSuccess', { succeeded: json.succeeded ?? 0, processed: json.processed ?? 0 }),
          })
          refresh()
        } else {
          setMessage({ type: 'error', text: json.error || t('mintFailed') })
        }
      } catch {
        setMessage({ type: 'error', text: t('mintFailed') })
      }
    })
  }

  const statusLabel = (status: string) => {
    try {
      return t(`status.${status}` as 'status.minted')
    } catch {
      return status
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">{t('description')}</p>
        </div>
        {(stats.approved > 0 || stats.minting > 0) && (
          <Button size="sm" disabled={isPending} onClick={handleBatchMint}>
            {t('batchMint')}
          </Button>
        )}
      </div>

      {message && (
        <div
          className={
            message.type === 'success'
              ? 'rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200'
              : 'rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive'
          }
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('stats.codes')}</CardDescription>
            <CardTitle>{stats.totalCodes}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('stats.rewards')}</CardDescription>
            <CardTitle>{stats.totalRewards}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('stats.pending')}</CardDescription>
            <CardTitle>{stats.pendingApproval}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('stats.minted')}</CardDescription>
            <CardTitle>
              {stats.minted} · {stats.totalMintedTokens.toFixed(2)} {tokenSymbol}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {stats.visitStats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t('stats.visitsTotal')}</CardDescription>
              <CardTitle>{stats.visitStats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t('stats.visitsToday')}</CardDescription>
              <CardTitle>{stats.visitStats.today}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t('stats.visits7d')}</CardDescription>
              <CardTitle>{stats.visitStats.last7d}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t('stats.visits28d')}</CardDescription>
              <CardTitle>{stats.visitStats.last28d}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t('pendingTitle')}</h2>
        {pending.length === 0 ? (
          <p className="text-muted-foreground">{t('empty')}</p>
        ) : (
          <div className="grid gap-4">
            {pending.map((reward) => (
              <RewardCard
                key={reward.id}
                reward={reward}
                tokenSymbol={tokenSymbol}
                statusLabel={statusLabel(reward.status)}
                t={t}
                isPending={isPending}
                onApprove={() => handleApprove(reward.id)}
                onReject={() => handleReject(reward.id)}
                showActions
              />
            ))}
          </div>
        )}
      </section>

      {failed.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{t('failedTitle')}</h2>
          <div className="grid gap-4">
            {failed.map((reward) => (
              <RewardCard
                key={reward.id}
                reward={reward}
                tokenSymbol={tokenSymbol}
                statusLabel={statusLabel(reward.status)}
                t={t}
                isPending={isPending}
                onRetry={() => handleRetryMint(reward.id)}
                showRetry
              />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t('recentTitle')}</h2>
        {recent.length === 0 ? (
          <p className="text-muted-foreground">{t('recentEmpty')}</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((reward) => (
              <li
                key={reward.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
              >
                <span>
                  {reward.refCode} · +{reward.rewardAmount} {tokenSymbol} · {statusLabel(reward.status)}
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
        )}
      </section>
    </div>
  )
}

function RewardCard({
  reward,
  tokenSymbol,
  statusLabel,
  t,
  isPending,
  onApprove,
  onReject,
  onRetry,
  showActions,
  showRetry,
}: {
  reward: PendingReward
  tokenSymbol: string
  statusLabel: string
  t: (key: string, values?: Record<string, string | number>) => string
  isPending: boolean
  onApprove?: () => void
  onReject?: () => void
  onRetry?: () => void
  showActions?: boolean
  showRetry?: boolean
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex flex-wrap items-center gap-2">
          <span>
            {t('order')}: {reward.orderId}
          </span>
          <span className="text-xs font-normal text-muted-foreground">{statusLabel}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          {t('refCode')}: <span className="font-mono">{reward.refCode}</span>
        </p>
        <p>
          {t('amount')}: {reward.rewardAmount} {tokenSymbol} ({reward.orderTotal} {reward.currency})
        </p>
        <p>
          {t('referrer')}: <span className="font-mono text-xs">{reward.referrerWallet}</span>
        </p>
        {reward.failureReason && (
          <p className="text-destructive text-xs">{reward.failureReason}</p>
        )}
        <div className="flex gap-2 pt-2">
          {showActions && onApprove && onReject && (
            <>
              <Button size="sm" disabled={isPending} onClick={onApprove}>
                {t('approve')}
              </Button>
              <Button size="sm" variant="outline" disabled={isPending} onClick={onReject}>
                {t('reject')}
              </Button>
            </>
          )}
          {showRetry && onRetry && (
            <Button size="sm" variant="secondary" disabled={isPending} onClick={onRetry}>
              {t('retryMint')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
