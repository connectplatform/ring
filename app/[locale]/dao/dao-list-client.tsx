'use client'

// Import required React, i18n, utility, and UI components.
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
import { Coins, ThumbsUp } from 'lucide-react'

// TODO: Refactor to use React 19 “use” and Next 16 built-in i18n once stable for translation hooks.
// TODO: Replace next-intl Link with Next.js Link when Next 16 built-in app directory <Link> supports locale-aware routing and asChild prop natively

/**
 * DaoListClient
 *
 * Client component: renders a responsive grid of DAO pools as cards. Each card includes:
 * - Type & status badges
 * - Title and description
 * - Likes, funding summary, and funding progress bar
 *
 * @param {pools} array of PublicPoolDoc - All pool objects to display
 * @param {locale} Locale - The active locale code for translation
 */
export function DaoListClient({
  pools,
  locale,
}: {
  pools: PublicPoolDoc[]
  locale: Locale
}) {
  // Translation hooks for different sections (main, status, kind)
  const t = useTranslations('modules.dao') // main DAO module translations
  const tStatus = useTranslations('modules.dao.admin.status') // status labels
  const tKind = useTranslations('modules.dao.admin.kind') // pool kind/type labels

  // Get the symbol for the app's native token (e.g., "RING")
  const nativeToken = getNativeTokenSymbol()

  // If there are no pools, render a visually styled "empty state" message.
  if (pools.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        {/* Show a localized 'empty' message, substituting the token symbol */}
        {t('listingEmpty', { token: nativeToken })}
      </div>
    )
  }

  // Otherwise, render the main grid of pool cards.
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {pools.map((pool) => {
        // Compute the route (href) for each pool's detail page using i18n-aware helpers.
        const href = toAppHref(ROUTES.DAO_POOL(pool.pool_slug, locale))
        // Compute funding goal as a percentage (number, 0-100) to display in the progress bar.
        const fundingPct = fundingProgressPct(pool.pledged_ring, pool.goal_ring)

        // TODO: When Next.js supports Link's `asChild` natively, refactor Link+Card to use <Card asChild><a href=...> for true semantic markup. This improves accessibility and SEO.

        // Render a single card for each pool wrapped in a localized Link (SSR-aware).
        return (
          <Link key={pool.id} href={href} className="block h-full">
            <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/20">
              <CardHeader className="space-y-2 pb-2">
                {/* Top section: badges for kind and status */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Badge for pool kind/type, translated and in all caps, tiny font */}
                  <Badge variant="secondary" className="text-[10px] uppercase">
                    {tKind(pool.pool_kind)}
                  </Badge>
                  {/* Badge for pool current status (translated), thin outline, tiny font */}
                  <Badge variant="outline" className="text-[10px]">
                    {tStatus(pool.status)}
                  </Badge>
                </div>
                {/* Title prominently displayed */}
                <CardTitle className="text-lg leading-snug">{pool.title}</CardTitle>
                {/* Description, condensed to max 2 lines */}
                <CardDescription className="line-clamp-2">{pool.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                {/* Meta info: likes & funding summary */}
                <div className="flex items-center gap-4">
                  {/* Likes count: thumbs up icon followed by raw like_count */}
                  <span className="inline-flex items-center gap-1">
                    <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
                    {pool.like_count}
                  </span>
                  {/* Funding summary: coin icon and i18n message (e.g., "134/200 RING") */}
                  <span className="inline-flex items-center gap-1">
                    <Coins className="h-3.5 w-3.5" aria-hidden />
                    {t('fundingSummary', {
                      pledged: pool.pledged_ring,
                      goal: pool.goal_ring,
                      token: nativeToken,
                    })}
                  </span>
                </div>
                {/* Progress bar visually representing funding percentage */}
                <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
                  <div
                    // The width of the bar is proportional to the funding progress.
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

// Export encodePoolSlugForRoute helper for use in other modules/tests.
// No logic change required here.
export { encodePoolSlugForRoute }
