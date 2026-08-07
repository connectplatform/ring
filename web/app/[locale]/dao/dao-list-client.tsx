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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Coins, Loader2, ThumbsUp } from 'lucide-react'
import { useCursorFeed } from '@/hooks/use-cursor-feed'
import { buildFilterFingerprint } from '@/lib/pagination/filter-fingerprint'
import { normalizePaginatedResponse } from '@/lib/pagination/normalize-paginated-response'
import { computePaginationCursor } from '@/lib/pagination/cursor-pagination'
import { ShareToChatButton } from '@/features/chat/interactive/share-to-chat-button'
import { PostDaoJarToChatButton } from '@/features/public-pools/components/post-dao-jar-to-chat-button'

const PAGE_LIMIT = 24

/**
 * DaoListClient — public pools grid with useCursorFeed infinite scroll.
 * TD-UX-02: Share / Post jar on card footer without navigating into detail.
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
          const fundingPct = fundingProgressPct(pool.pledged_native_token, pool.goal_native_token)

          return (
            <Card key={pool.id} className="flex h-full flex-col transition-colors hover:border-primary/40 hover:bg-muted/20">
              <Link href={href} className="block min-w-0 flex-1">
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
                        pledged: pool.pledged_native_token,
                        goal: pool.goal_native_token,
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
              </Link>
              <CardFooter
                className="flex flex-wrap gap-2 border-t border-border/40 pt-3"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <ShareToChatButton
                  targetType="dao_pool"
                  targetId={pool.pool_slug}
                  title={pool.title}
                  description={pool.description}
                  url={ROUTES.DAO_POOL(pool.pool_slug, locale)}
                />
                <PostDaoJarToChatButton poolSlug={pool.pool_slug} />
              </CardFooter>
            </Card>
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
