import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import type { LocalePageProps } from '@/utils/page-props'
import { getUserByUsername } from '@/features/auth/services/get-user-by-username'
import { listPublicEnabledGamesForOwner } from '@/features/peer-games/service'
import {
  localizedCatalogDescription,
  localizedCatalogTitle,
} from '@/features/peer-games/lib/catalog-i18n'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { ROUTES } from '@/constants/routes'
import { Button } from '@/components/ui/button'
import { auth } from '@/auth'
import { PublicPlayWithMe } from '@/features/peer-games/components/public-play-with-me'
import {
  maybePrivatePersonalPageShell,
  privatePersonalPageRobots,
} from '@/features/auth/lib/personal-page-route-gate'

type Params = { username: string }

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; username: string }>
}): Promise<Metadata> {
  const { locale: localeParam, username } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  const user = await getUserByUsername(username)
  if (!user) return {}
  const displayName = user.name || user.username || username
  if (!user.publicProfile) {
    return {
      title: `@${user.username || username} — Games`,
      ...privatePersonalPageRobots(),
    }
  }
  return buildLocalizedMetadata({
    locale,
    path: 'profile.games.public',
    pathname: `/${encodeURIComponent(username)}/games`,
    variables: { username: displayName },
    fallback: {
      title: `${displayName} — Games`,
      description: `Peer games available with ${displayName}`,
    },
  })
}

export default async function PublicGamesPage(props: LocalePageProps<Params>) {
  const { locale: localeParam, username } = await props.params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const user = await getUserByUsername(username)
  if (!user) notFound()

  const session = await auth()
  const privateShell = maybePrivatePersonalPageShell({
    user,
    session,
    locale,
    username,
  })
  if (privateShell) return privateShell

  const isOwner = Boolean(session?.user?.id && session.user.id === user.id)
  const slugs = await listPublicEnabledGamesForOwner(user.id)
  const displayName = user.name || user.username || username
  const tGames = await getTranslations({ locale, namespace: 'modules.games' })

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">
          <Link href={ROUTES.PUBLIC_PROFILE(username, locale)} className="hover:underline">
            @{user.username || username}
          </Link>
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            {displayName} — {tGames('marketplaceTitle')}
          </h1>
          {isOwner ? (
            <Button asChild>
              <Link href={ROUTES.PROFILE_GAMES(locale)}>{tGames('manageMyGames')}</Link>
            </Button>
          ) : null}
        </div>
        <p className="text-muted-foreground">{tGames('marketplaceDescription')}</p>
      </header>

      {slugs.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center space-y-4">
          <p className="text-muted-foreground">No public games enabled yet.</p>
          {isOwner ? (
            <Button asChild>
              <Link href={ROUTES.PROFILE_GAMES(locale)}>{tGames('manageMyGames')}</Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-4">
          {slugs.map((slug) => {
            return (
              <li
                key={slug}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 p-4"
              >
                <div>
                  <p className="font-medium">{localizedCatalogTitle(tGames, slug)}</p>
                  <p className="text-sm text-muted-foreground">
                    {localizedCatalogDescription(tGames, slug)}
                  </p>
                </div>
                {!isOwner && session?.user?.id ? (
                  <PublicPlayWithMe
                    targetUserId={user.id}
                    slug={slug}
                    displayName={displayName}
                  />
                ) : !isOwner ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={ROUTES.LOGIN(locale)}>Sign in to play</Link>
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href={ROUTES.PUBLIC_PROFILE(username, locale)}>Back to profile</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={ROUTES.GAMES(locale)}>{tGames('marketplaceTitle')}</Link>
        </Button>
      </div>
    </div>
  )
}
