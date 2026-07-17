'use client'

import { useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Link, toAppHref } from '@/i18n/routing'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import type { PublicPoolDoc } from '@/lib/zod/public-pool-schemas'
import { encodePoolSlugForRoute } from '@/lib/public-pools/pool-slug'
import { fundingProgressPct } from '@/lib/public-pools/goal-ring'
import { getNativeTokenSymbol } from '@/lib/ring-config-chain'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Coins, Loader2, ThumbsUp } from 'lucide-react'
import { useCursorFeed } from '@/hooks/use-cursor-feed'
import { buildFilterFingerprint } from '@/lib/pagination/filter-fingerprint'
import { normalizePaginatedResponse } from '@/lib/pagination/normalize-paginated-response'
import { computePaginationCursor } from '@/lib/pagination/cursor-pagination'

const PAGE_LIMIT = 24

/**
 * DaoListClient — public pools grid with useCursorFeed infinite scroll.
 */
export function DaoListClient({
  pools: initialPools,
  locale,
  status,
}: {
  pools: PublicPoolDoc[]
  locale: Locale
  status?: string
}) {
  const t = useTranslations('modules.dao')
  const tStatus = useTranslations('modules.dao.admin.status')
  const tKind = useTranslations('modules.dao.admin.kind')
  const nativeToken = getNativeTokenSymbol()

  const filterFingerprint = useMemo(
    () => buildFilterFingerprint('public-pools', { status: status || 'all' }),
    [status],
  )

  const initialCursor = useMemo(() => {
    const { nextCursor } = computePaginationCursor(initialPools, PAGE_LIMIT, (p) => p.id)
    return nextCursor
  }, [initialPools])

  const fetchPage = useCallback(
    async (cursor: string | null) => {
      const params = new URLSearchParams({ limit: String(PAGE_LIMIT) })
      if (status) params.set('status', status)
      if (cursor) params.set('startAfter', cursor)

      const res = await fetch(`/api/public-pools?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load pools')
      const data = await res.json()
      return normalizePaginatedResponse<PublicPoolDoc>(
        {
          pools: data.pools,
          items: data.items ?? data.pools,
          cursor: data.cursor,
          hasMore: data.hasMore,
        },
        PAGE_LIMIT,
      )
    },
    [status],
  )

  const { items: pools, loading, hasMore, sentinelRef } = useCursorFeed<PublicPoolDoc>({
    moduleId: 'public-pools',
    locale,
    limit: PAGE_LIMIT,
    filterFingerprint,
    initialItems: initialPools,
    initialCursor,
    fetchPage,
  })

  if (pools.length === 0 && !loading) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        {t('listingEmpty', { token: nativeToken })}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pools.map((pool) => {
          const href = toAppHref(ROUTES.DAO_POOL(pool.pool_slug, locale))
          const fundingPct = fundingProgressPct(pool.pledged_ring, pool.goal_ring)

          return (
            <Link key={pool.id} href={href} className="block h-full">
              <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/20">
                <CardHeader className="space-y-2 pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      {tKind(pool.pool_kind)}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {tStatus(pool.status)}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg leading-snug">{pool.title}</CardTitle>
                  <CardDescription className="line-clamp-2">{pool.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span className="inline-flex items-center gap-1">
                      <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
                      {pool.like_count}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Coins className="h-3.5 w-3.5" aria-hidden />
                      {t('fundingSummary', {
                        pledged: pool.pledged_ring,
                        goal: pool.goal_ring,
                        token: nativeToken,
                      })}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${fundingPct}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
      {loading && (
        <div className="flex justify-center py-4 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}
      {hasMore && <div ref={sentinelRef} className="h-10" aria-hidden />}
    </div>
  )
}

export { encodePoolSlugForRoute }
