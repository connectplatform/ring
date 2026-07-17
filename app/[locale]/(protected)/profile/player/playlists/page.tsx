import Link from 'next/link'
import { setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import type { LocalePageProps } from '@/utils/page-props'
import { listMoodPlaylistsByOwner } from '@/features/mood-player/service'
import { ROUTES } from '@/constants/routes'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default async function MoodPlaylistsPage(props: LocalePageProps) {
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

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Mood playlists</h1>
          <p className="text-sm text-muted-foreground">
            Upload or generate arrangements. Embed with{' '}
            <code className="rounded bg-muted px-1 text-xs">&lt;ring-mood-player playlist=&quot;…&quot;&gt;</code>
          </p>
        </div>
        <Button asChild>
          <Link href={ROUTES.PROFILE_PLAYER_PLAYLIST_NEW(locale)}>
            <Plus className="mr-1 h-4 w-4" /> New playlist
          </Link>
        </Button>
      </div>

      {playlists.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          No playlists yet. Create one to start healing through music.
        </div>
      ) : (
        <ul className="space-y-2">
          {playlists.map((p) => (
            <li key={p.id}>
              <Link
                href={ROUTES.PROFILE_PLAYER_PLAYLIST(p.id, locale)}
                className="flex items-center justify-between rounded-lg border px-4 py-3 transition hover:bg-muted/50"
              >
                <div>
                  <p className="font-medium">{p.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.songs?.length || 0} songs · {p.visibility}
                    {p.isPrimary ? ' · primary' : ''}
                  </p>
                </div>
                <span className="text-sm text-muted-foreground">Edit →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
