import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import type { LocalePageProps } from '@/utils/page-props'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { getCatalogEntry, isPeerGameSlug } from '@/features/peer-games/catalog'
import {
  localizedCatalogDescription,
  localizedCatalogTitle,
} from '@/features/peer-games/lib/catalog-i18n'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { PeerGameSessionClient } from '@/features/peer-games/components/peer-game-session-client'

type Params = { slug: string }

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale: localeParam, slug } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  const entry = getCatalogEntry(slug)
  const tGames = await getTranslations({ locale, namespace: 'modules.games' })
  const title = entry ? localizedCatalogTitle(tGames, slug) : slug
  const description = entry
    ? localizedCatalogDescription(tGames, slug)
    : 'Peer mini-game'
  return buildLocalizedMetadata({
    locale,
    path: 'games.slug',
    pathname: `/games/${encodeURIComponent(slug)}`,
    variables: { game: title },
    fallback: {
      title,
      description,
    },
  })
}

export default async function GameSlugPage(
  props: LocalePageProps<Params> & {
    searchParams?: Promise<{ session?: string }>
  },
) {
  const { locale: localeParam, slug } = await props.params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  if (!isPeerGameSlug(slug)) notFound()
  const entry = getCatalogEntry(slug)
  if (!entry) notFound()

  const tGames = await getTranslations({ locale, namespace: 'modules.games' })
  const sp = props.searchParams ? await props.searchParams : {}
  const sessionId = typeof sp.session === 'string' ? sp.session : null

  return (
    <RingRightRailLayout showRightRail={false} flushCenterPane>
      <DavinciCenterPane>
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
          <header className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {localizedCatalogTitle(tGames, slug)}
            </h1>
            <p className="text-sm text-muted-foreground">
              {localizedCatalogDescription(tGames, slug)}
            </p>
          </header>
          <PeerGameSessionClient slug={slug} sessionId={sessionId} />
        </div>
      </DavinciCenterPane>
    </RingRightRailLayout>
  )
}
