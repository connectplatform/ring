import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import type { LocalePageProps } from '@/utils/page-props'
import { auth } from '@/auth'
import { hasMemberPrivileges, resolveSessionUserRole } from '@/features/auth/user-role'
import { getUserPeerGames } from '@/features/peer-games/service'
import { listCatalog } from '@/features/peer-games/catalog'
import { ROUTES } from '@/constants/routes'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { ProfileGamesManager } from '@/features/peer-games/components/profile-games-manager'
import { Button } from '@/components/ui/button'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'

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
  return buildLocalizedMetadata({
    locale,
    path: 'profile.games',
    pathname: '/profile/games',
    fallback: {
      title: 'My Games',
      description: 'Publish which peer games you are available to play.',
    },
  })
}

export default async function ProfileGamesPage(props: LocalePageProps) {
  const { locale: localeParam } = await props.params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const session = await auth()
  if (!session?.user?.id) {
    redirect(ROUTES.LOGIN(locale))
  }

  const role = resolveSessionUserRole(session.user.role as string)
  const isMember = hasMemberPrivileges(role)
  const doc = await getUserPeerGames(session.user.id)
  const username =
    (session.user.username as string | undefined) ||
    session.user.name ||
    undefined

  return (
    <RingRightRailLayout showRightRail={false} flushCenterPane>
      <DavinciCenterPane>
        <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
          <header className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">My Games</h1>
            <p className="text-muted-foreground">
              Choose which games appear on your public profile. Members only.
            </p>
            {username ? (
              <Button asChild variant="outline" size="sm">
                <Link href={ROUTES.PUBLIC_PROFILE_GAMES(String(username), locale)}>
                  View public page
                </Link>
              </Button>
            ) : null}
          </header>

          {!isMember ? (
            <div className="rounded-xl border border-dashed p-8 text-center space-y-4">
              <p className="text-muted-foreground">
                Member privileges are required to publish game availability.
              </p>
              <Button asChild>
                <Link href={ROUTES.MEMBERSHIP(locale)}>Upgrade membership</Link>
              </Button>
            </div>
          ) : (
            <ProfileGamesManager
              catalog={listCatalog().map((e) => ({
                slug: e.slug,
                title: e.title,
                description: e.description,
              }))}
              initialEnabled={doc?.enabledSlugs ?? []}
            />
          )}
        </div>
      </DavinciCenterPane>
    </RingRightRailLayout>
  )
}
