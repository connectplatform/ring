import { Suspense } from 'react'
import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import type { LocalePageProps } from '@/utils/page-props'
import { listMoodPlaylistsByOwner } from '@/features/mood-player/service'
import { ProfileSongsShell } from '@/features/mood-player/components/profile-songs-shell'
import { ROUTES } from '@/constants/routes'
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
    path: 'profile.songs.manage',
    pathname: '/profile/songs',
    robots: { index: false, follow: false },
    fallback: {
      title: 'Manage Songs',
      description: 'Create and edit mood playlists',
    },
  })
}

export default async function ProfileSongsManagePage(props: LocalePageProps) {
  const { locale: localeParam } = await props.params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const session = await auth()
  if (!session?.user?.id) {
    redirect(ROUTES.LOGIN(locale))
  }

  const playlists = await listMoodPlaylistsByOwner(session.user.id)
  const username = (session.user as { username?: string })?.username
  const publicSongsHref = username
    ? ROUTES.PUBLIC_PROFILE_PLAYER(username, locale)
    : undefined
  const profileSongsPath = ROUTES.PROFILE_SONGS(locale)

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[320px] items-center justify-center p-6 text-sm text-muted-foreground">
          Loading songs…
        </div>
      }
    >
      <ProfileSongsShell
        playlists={playlists}
        publicSongsHref={publicSongsHref}
        profileSongsPath={profileSongsPath}
      />
    </Suspense>
  )
}
