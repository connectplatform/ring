'use client'

import React, { startTransition, useActionState, useCallback, useEffect, useOptimistic, useState } from 'react'
import { Clock, Coins, Sparkles, ThumbsUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  BorderBeam,
  davinciAuthButtonLift,
  davinciBeamInnerSurface,
  davinciGlassSurface,
  HeroAmbient,
} from '@/lib/ui/davinci'
import type { FutureFeatureWidgetData } from '@/lib/docs/future-feature-types'
import { useDocsPoolPath } from '@/components/docs/docs-pool-context'
import { deriveFutureFeaturePoolSlug } from '@/lib/public-pools/pool-slug'
import type { PublicPoolStatsResponse } from '@/lib/zod/public-pool-schemas'
import {
  ensureFutureFeaturePoolClient,
  likeActionReducer,
  type LikeActionState,
} from '@/features/public-pools/actions/public-pool-client'
import { PoolContributePanel } from '@/features/public-pools/components/pool-contribute-panel'
import { getClientNativeTokenSymbol } from '@/lib/ring-config-client'
import { Button } from '@/components/ui/button'
import { ShareToChatButton } from '@/features/chat/interactive/share-to-chat-button'
import { PostDaoJarToChatButton } from '@/features/public-pools/components/post-dao-jar-to-chat-button'
import { ROUTES } from '@/constants/routes'
import { useLocale } from 'next-intl'
import type { Locale } from '@/i18n/shared'

export type FutureFeatureWidgetProps = FutureFeatureWidgetData

function ProgressTrack({
  label,
  value,
  max,
  pct,
}: {
  label: string
  value: number | string
  max: number | string
  pct: number
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">
          {value} / {max}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
        <div
          className="h-full rounded-full bg-[var(--davinci-beam,hsl(var(--primary)))] transition-all duration-300"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  )
}

export function FutureFeatureWidget({
  name,
  description,
  implementationCost,
  labels = [],
  poolSlug: poolSlugProp,
}: FutureFeatureWidgetProps) {
  const locale = useLocale() as Locale
  const docPath = useDocsPoolPath()
  const resolvedSlug =
    poolSlugProp?.trim() || deriveFutureFeaturePoolSlug(docPath, name)

  const [stats, setStats] = useState<PublicPoolStatsResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [chipOpen, setChipOpen] = useState(false)
  const tokenSymbol = getClientNativeTokenSymbol()

  const [optimisticLiked, setOptimisticLiked] = useOptimistic(
    stats?.user_has_liked ?? false,
    (_current, next: boolean) => next,
  )
  const [optimisticLikes, setOptimisticLikes] = useOptimistic(
    stats?.pool.like_count ?? 0,
    (_current, next: number) => next,
  )

  const [, likeAction, likePending] = useActionState<LikeActionState, string>(
    async (prev, slug) => {
      const next = await likeActionReducer(prev, slug)
      if (next.stats) {
        setStats(next.stats)
      }
      return next
    },
    { error: null, stats: null },
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { stats: loaded } = await ensureFutureFeaturePoolClient({
          docPath,
          name,
          description,
          implementationCost,
          labels,
          poolSlug: poolSlugProp,
        })
        if (!cancelled) {
          setStats(loaded)
          setLoadError(null)
        }
      } catch {
        if (!cancelled) {
          setLoadError('Pool unavailable')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [docPath, name, description, implementationCost, labels, poolSlugProp])

  const handleLike = useCallback(() => {
    if (likePending || stats?.pool.status === 'completed') return
    const nextLiked = !optimisticLiked
    const nextCount = optimisticLikes + (nextLiked ? 1 : -1)
    startTransition(() => {
      setOptimisticLiked(nextLiked)
      setOptimisticLikes(Math.max(0, nextCount))
      void likeAction(resolvedSlug)
    })
  }, [
    likeAction,
    likePending,
    optimisticLiked,
    optimisticLikes,
    resolvedSlug,
    stats?.pool.status,
    setOptimisticLiked,
    setOptimisticLikes,
  ])

  const displayStats = stats
  const likeCount = likePending ? optimisticLikes : (displayStats?.pool.like_count ?? optimisticLikes)
  const userLiked = likePending ? optimisticLiked : (displayStats?.user_has_liked ?? optimisticLiked)
  const pledged = displayStats?.pool.pledged_native_token ?? '0'
  const goalRing = displayStats?.pool.goal_native_token ?? String(Math.max(implementationCost, 1))
  const fundingPct = displayStats?.funding_progress_pct ?? 0
  const likesPct = displayStats?.likes_progress_pct ?? 0
  const isQueued =
    displayStats?.pool.status === 'queued' ||
    displayStats?.pool.status === 'in_progress'
  const isCompleted = displayStats?.pool.status === 'completed'
  const frozenSignal = displayStats?.pool.signal_at_completion

  return (
    <BorderBeam
      duration="6s"
      className={cn(
        davinciGlassSurface,
        davinciAuthButtonLift,
        'future-feature-widget relative overflow-hidden',
      )}
      innerClassName={cn(davinciBeamInnerSurface, 'p-4 sm:p-5')}
    >
      <HeroAmbient className="rounded-[inherit] opacity-40" />

      <div className="relative z-[1] space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles
                className="h-4 w-4 shrink-0 text-[var(--davinci-beam)]"
                aria-hidden
              />
              <h4 className="text-sm font-semibold leading-snug text-foreground">{name}</h4>
              {isQueued && !isCompleted ? (
                <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
                  Queued
                </span>
              ) : null}
              {isCompleted ? (
                <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">
                  Shipped
                </span>
              ) : null}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium',
                'border border-[color-mix(in_oklch,var(--davinci-beam)_28%,transparent)]',
                'bg-[color-mix(in_oklch,var(--davinci-beam)_8%,transparent)]',
                'text-[var(--davinci-beam)]',
              )}
              title={`Estimated implementation effort (1h = 1 ${tokenSymbol})`}
            >
              <Clock className="h-3 w-3" aria-hidden />
              ~{displayStats?.pool.goal_hours ?? Math.max(implementationCost, 1)}h
            </span>
            <button
              type="button"
              onClick={handleLike}
              disabled={likePending || isCompleted || Boolean(loadError)}
              className={cn(
                'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors',
                'border',
                userLiked
                  ? 'border-[var(--davinci-beam)] bg-[color-mix(in_oklch,var(--davinci-beam)_12%,transparent)] text-[var(--davinci-beam)]'
                  : 'border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/50',
              )}
              title={isCompleted ? 'Final community signal' : 'Toggle like (1 per member)'}
            >
              <ThumbsUp className="h-3 w-3" aria-hidden />
              {isCompleted && frozenSignal != null ? frozenSignal : likeCount}
            </button>
          </div>
        </div>

        {!loadError && displayStats ? (
          <div className="space-y-2">
            <ProgressTrack
              label={`${tokenSymbol} pledged`}
              value={pledged}
              max={goalRing}
              pct={fundingPct}
            />
            <ProgressTrack
              label="Likes"
              value={likeCount}
              max={displayStats.like_threshold}
              pct={likesPct}
            />
          </div>
        ) : null}

        {loadError ? (
          <p className="text-[11px] text-muted-foreground">{loadError}</p>
        ) : null}

        {!isCompleted && !loadError ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              onClick={() => setChipOpen((v) => !v)}
            >
              <Coins className="h-3.5 w-3.5" aria-hidden />
              Chip in {tokenSymbol}
            </Button>
            <ShareToChatButton
              targetType="future_feature"
              targetId={resolvedSlug}
              title={name}
              description={description}
              url={ROUTES.DAO_POOL(resolvedSlug, locale)}
            />
            <PostDaoJarToChatButton poolSlug={resolvedSlug} />
          </div>
        ) : !loadError ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <ShareToChatButton
              targetType="future_feature"
              targetId={resolvedSlug}
              title={name}
              description={description}
              url={ROUTES.DAO_POOL(resolvedSlug, locale)}
            />
            <PostDaoJarToChatButton poolSlug={resolvedSlug} />
          </div>
        ) : null}

        {chipOpen ? (
          <PoolContributePanel
            poolSlug={resolvedSlug}
            locale={locale}
            needSummary={name}
            onCancel={() => setChipOpen(false)}
            onNativeTokenSuccess={async () => {
              try {
                const { fetchPoolStats } = await import(
                  '@/features/public-pools/actions/public-pool-client'
                )
                const next = await fetchPoolStats(resolvedSlug)
                if (next) setStats(next)
              } catch {
                /* non-fatal */
              }
            }}
          />
        ) : null}

        {labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {labels.map((label) => (
              <span
                key={label}
                className={cn(
                  'rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                  'border border-border/60 bg-muted/40 text-muted-foreground',
                )}
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </BorderBeam>
  )
}

export interface FutureFeatureBacklogProps {
  title?: string
  description?: string
  children: React.ReactNode
}

/** Groups `<FutureFeatureWidget />` cards removed from legacy docs — TBD roadmap. */
export function FutureFeatureBacklog({
  title = 'Backlog (TBD)',
  description = 'Items stripped during truth-verification passes. Not implemented in OSS today; estimates are planning hints only.',
  children,
}: FutureFeatureBacklogProps) {
  return (
    <section className="my-10 space-y-4" aria-labelledby="future-feature-backlog-heading">
      <div className="space-y-2 border-b border-border/60 pb-3">
        <h2 id="future-feature-backlog-heading" className="text-2xl font-semibold tracking-tight">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  )
}
