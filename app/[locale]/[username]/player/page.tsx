import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import type { LocalePageProps } from '@/utils/page-props'
import { getUserByUsername } from '@/features/auth/services/get-user-by-username'
import {
  getPublicPrimaryPlaylistForOwner,
  listPublicPlaylistsForOwner,
} from '@/features/mood-player/service'
import { PublicPlayerShell } from '@/features/mood-player/components/public-player-shell'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { auth } from '@/auth'
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
      title: `@${user.username || username} — Player`,
      ...privatePersonalPageRobots(),
    }
  }
  return buildLocalizedMetadata({
    locale,
    path: 'profile.player',
    pathname: `/${encodeURIComponent(username)}/player`,
    variables: { username: displayName },
    fallback: {
      title: `${displayName} — Player`,
      description: `Mood playlists by ${displayName}`,
    },
  })
}

export default async function PublicPlayerPage(props: LocalePageProps<Params>) {
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

  const primary = await getPublicPrimaryPlaylistForOwner(user.id)
  const all = await listPublicPlaylistsForOwner(user.id)
  const displayName = user.name || user.username || username
  const profileUsername = user.username || username

  return (
    <PublicPlayerShell
      username={profileUsername}
      displayName={displayName}
      locale={locale}
      isOwner={isOwner}
      playlists={all}
      initialId={primary?.id}
    />
  )
}
