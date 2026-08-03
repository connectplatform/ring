import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import type { LocalePageProps } from '@/utils/page-props'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { ROUTES } from '@/constants/routes'
import { listCatalog } from '@/features/peer-games/catalog'
import {
  localizedCatalogDescription,
  localizedCatalogTitle,
} from '@/features/peer-games/lib/catalog-i18n'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { Button } from '@/components/ui/button'
import { auth } from '@/auth'
import { hasMemberPrivileges, resolveSessionUserRole } from '@/features/auth/user-role'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  const tGames = await getTranslations({ locale, namespace: 'modules.games' })
  return buildLocalizedMetadata({
    locale,
    path: 'games',
    pathname: '/games',
    fallback: {
      title: tGames('marketplaceTitle'),
      description: tGames('marketplaceDescription'),
    },
  })
}

export default async function GamesMarketplacePage(props: LocalePageProps) {
  const { locale: localeParam } = await props.params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const tGames = await getTranslations({ locale, namespace: 'modules.games' })
  const session = await auth()
  const role = resolveSessionUserRole(session?.user?.role as string)
  const isMember = hasMemberPrivileges(role)
  const catalog = listCatalog()

  return (
    <RingRightRailLayout showRightRail={false} flushCenterPane>
      <DavinciCenterPane>
        <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
          <header className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              {tGames('marketplaceTitle')}
            </h1>
            <p className="text-muted-foreground">{tGames('marketplaceDescription')}</p>
            <div className="flex flex-wrap gap-2 pt-2">
              {isMember ? (
                <Button asChild>
                  <Link href={ROUTES.PROFILE_GAMES(locale)}>{tGames('manageMyGames')}</Link>
                </Button>
              ) : (
                <Button asChild variant="outline">
                  <Link href={ROUTES.MEMBERSHIP(locale)}>{tGames('becomeMember')}</Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link href={ROUTES.MESSAGES(locale)}>{tGames('openMessages')}</Link>
              </Button>
            </div>
          </header>

          <div className="grid gap-4 sm:grid-cols-2">
            {catalog.map((entry) => (
              <div
                key={entry.slug}
                className="space-y-3 rounded-xl border border-border/60 p-5"
              >
                <div>
                  <h2 className="text-lg font-medium">
                    {localizedCatalogTitle(tGames, entry.slug)}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {localizedCatalogDescription(tGames, entry.slug)}
                  </p>
                </div>
                <Button asChild variant="secondary" size="sm">
                  <Link href={ROUTES.GAMES_SLUG(entry.slug, locale)}>
                    {tGames('openMiniApp')}
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DavinciCenterPane>
    </RingRightRailLayout>
  )
}
