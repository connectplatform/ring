import type { Metadata } from 'next'
import Link from 'next/link'
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
import { PublicSongsPlayer } from '@/features/mood-player/components/public-songs-player'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { ROUTES } from '@/constants/routes'
import { Button } from '@/components/ui/button'

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
  return buildLocalizedMetadata({
    locale,
    path: 'profile.songs',
    pathname: `/${encodeURIComponent(username)}/songs`,
    variables: { username: displayName },
    fallback: {
      title: `${displayName} — Songs`,
      description: `Mood playlists by ${displayName}`,
    },
  })
}

export default async function PublicSongsPage(props: LocalePageProps<Params>) {
  const { locale: localeParam, username } = await props.params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const user = await getUserByUsername(username)
  if (!user) notFound()

  const primary = await getPublicPrimaryPlaylistForOwner(user.id)
  const all = await listPublicPlaylistsForOwner(user.id)
  const displayName = user.name || user.username || username

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">
          <Link href={ROUTES.PUBLIC_PROFILE(username, locale)} className="hover:underline">
            @{user.username || username}
          </Link>
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{displayName} — Songs</h1>
        <p className="text-muted-foreground">
          Same lyrics, shifting moods. Use Next/Previous for songs and Mood to change arrangement.
        </p>
      </header>

      <PublicSongsPlayer playlists={all} initialId={primary?.id} />

      <div>
        <Button asChild variant="outline">
          <Link href={ROUTES.PUBLIC_PROFILE(username, locale)}>Back to profile</Link>
        </Button>
      </div>
    </div>
  )
}
