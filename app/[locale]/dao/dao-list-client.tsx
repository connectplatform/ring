'use client'

import { useTranslations } from 'next-intl'
import { Link, toAppHref } from '@/i18n/routing'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import type { PublicPoolDoc } from '@/lib/zod/public-pool-schemas'
import { encodePoolSlugForRoute } from '@/lib/public-pools/pool-slug'
import { fundingProgressPct } from '@/lib/public-pools/goal-ring'
import { getRingTokenSymbol } from '@/lib/ring-config-core'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Coins, ThumbsUp } from 'lucide-react'

export function DaoListClient({
  pools,
  locale,
}: {
  pools: PublicPoolDoc[]
  locale: Locale
}) {
  const t = useTranslations('modules.dao')
  const tStatus = useTranslations('modules.dao.admin.status')
  const tKind = useTranslations('modules.dao.admin.kind')
  const nativeToken = getRingTokenSymbol()

  if (pools.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        {t('listingEmpty', { token: nativeToken })}
      </div>
    )
  }

  return (
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
  )
}

/** Encode slug for route helpers — exported for tests and links. */
export { encodePoolSlugForRoute }
