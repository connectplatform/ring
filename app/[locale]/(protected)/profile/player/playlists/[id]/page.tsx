import { setRequestLocale } from 'next-intl/server'
import { redirect, notFound } from 'next/navigation'
import { auth } from '@/auth'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import type { LocalePageProps } from '@/utils/page-props'
import { getMoodPlaylistById } from '@/features/mood-player/service'
import { PlaylistEditor } from '@/features/mood-player/components/playlist-editor'
import { MoodPlayer } from '@/features/mood-player/components/mood-player'
import { ROUTES } from '@/constants/routes'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { deleteMoodPlaylistAction } from '@/app/_actions/mood-player'

type Params = { id: string }

export default async function EditMoodPlaylistPage(props: LocalePageProps<Params>) {
  const { locale: localeParam, id } = await props.params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const session = await auth()
  if (!session?.user?.id) redirect(ROUTES.LOGIN(locale))

  const playlist = await getMoodPlaylistById(id)
  if (!playlist) notFound()
  if (playlist.ownerId !== session.user.id) notFound()

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm">
            <Link href={ROUTES.PROFILE_PLAYER_PLAYLISTS(locale)}>← Playlists</Link>
          </Button>
          <h1 className="text-2xl font-semibold">Edit playlist</h1>
          <p className="text-xs text-muted-foreground">
            Embed: <code>{`<ring-mood-player playlist="${playlist.id}"></ring-mood-player>`}</code>
          </p>
        </div>
        <form action={deleteMoodPlaylistAction}>
          <input type="hidden" name="playlistId" value={playlist.id} />
          <Button type="submit" variant="destructive" size="sm">
            Delete
          </Button>
        </form>
      </div>

      {playlist.songs?.some((s) => s.fileUrl) ? (
        <MoodPlayer playlist={playlist} compact showLyrics={false} />
      ) : null}

      <PlaylistEditor playlist={playlist} />
    </div>
  )
}
