'use client'

/**
 * ProfileSongsShell — owner mood-playlist management (messages-style layout)
 * Right rail: Songs title + +, search, playlist roster
 * Center: DaVinci empty state | NewPlaylistForm | PlaylistEditor
 */

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Music2, Plus, Search, Sparkles } from 'lucide-react'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { MoodPlaylist } from '@/features/mood-player/schemas'
import { PlaylistEditor } from '@/features/mood-player/components/playlist-editor'
import { MoodPlayer } from '@/features/mood-player/components/mood-player'
import { NewPlaylistForm } from '@/features/mood-player/components/new-playlist-form'
import { deleteMoodPlaylistAction } from '@/app/_actions/mood-player'
import { songHasPlayableAudio } from '@/features/mood-player/lib/resolve-active-track'

export type ProfileSongsShellProps = {
  playlists: MoodPlaylist[]
  publicSongsHref?: string
  profileSongsPath: string
}

function playableCount(p: MoodPlaylist): number {
  return (p.songs || []).filter((s) => songHasPlayableAudio(s)).length
}

export function ProfileSongsShell({
  playlists: initialPlaylists,
  publicSongsHref,
  profileSongsPath,
}: ProfileSongsShellProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const paramP = searchParams.get('p')
  const paramNew = searchParams.get('new') === '1'

  const [playlists, setPlaylists] = useState(initialPlaylists)
  const [selectedId, setSelectedId] = useState<string | null>(paramP)
  const [creating, setCreating] = useState(paramNew)
  const [searchQuery, setSearchQuery] = useState('')
  const [railOpen, setRailOpen] = useState(false)

  useEffect(() => {
    setPlaylists(initialPlaylists)
  }, [initialPlaylists])

  useEffect(() => {
    if (paramP) {
      setSelectedId(paramP)
      setCreating(false)
    }
  }, [paramP])

  useEffect(() => {
    if (paramNew) setCreating(true)
  }, [paramNew])

  const syncUrl = useCallback(
    (id: string | null, opts?: { new?: boolean }) => {
      startTransition(() => {
        if (opts?.new) {
          router.replace(`${profileSongsPath}?new=1`)
          return
        }
        if (id) {
          router.replace(`${profileSongsPath}?p=${encodeURIComponent(id)}`)
        } else {
          router.replace(profileSongsPath)
        }
      })
    },
    [router, profileSongsPath]
  )

  const selectPlaylist = useCallback(
    (id: string) => {
      setSelectedId(id)
      setCreating(false)
      setRailOpen(false)
      syncUrl(id)
    },
    [syncUrl]
  )

  const startCreate = useCallback(() => {
    setSelectedId(null)
    setCreating(true)
    setRailOpen(false)
    syncUrl(null, { new: true })
  }, [syncUrl])

  const onBack = useCallback(() => {
    setSelectedId(null)
    setCreating(false)
    setRailOpen(true)
    syncUrl(null)
  }, [syncUrl])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return playlists
    return playlists.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
    )
  }, [playlists, searchQuery])

  const selected = useMemo(
    () => playlists.find((p) => p.id === selectedId) ?? null,
    [playlists, selectedId]
  )

  const rail = (
    <div className="flex h-[calc(100dvh-5.5rem)] min-h-0 flex-col">
      <div className="shrink-0 space-y-3 pb-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Music2 className="h-5 w-5" aria-hidden />
            Songs
          </h1>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 w-11 shrink-0 p-0"
            onClick={startCreate}
            aria-label="New playlist"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search playlists…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            aria-label="Search playlists"
          />
        </div>
        {publicSongsHref ? (
          <Button asChild variant="outline" size="sm" className="w-full justify-start gap-2">
            <Link href={publicSongsHref}>
              <Sparkles className="h-3.5 w-3.5" />
              Open public player
            </Link>
          </Button>
        ) : null}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1 pr-1">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {playlists.length === 0
                ? 'No playlists yet'
                : 'No matches'}
            </p>
          ) : (
            filtered.map((p) => {
              const active = p.id === selectedId && !creating
              const n = playableCount(p)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectPlaylist(p.id)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors',
                    'hover:bg-accent/50',
                    active && 'bg-accent'
                  )}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Music2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {n} playable · {p.songs?.length || 0} songs · {p.visibility}
                    </p>
                  </div>
                  {p.isPrimary ? (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      primary
                    </Badge>
                  ) : null}
                </button>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )

  return (
    <RingRightRailLayout
      rightRail={rail}
      showRightRail
      flushCenterPane
      contentClassName="!pb-0"
      railWidth={320}
      rightRailPurpose="generic"
      isOpen={railOpen}
      onToggle={setRailOpen}
    >
      <DavinciCenterPane
        className="h-[calc(100dvh-5.5rem)]"
        contentClassName="!p-[5px] overflow-y-auto"
        header={
          selected || creating ? (
            <div className="flex flex-wrap items-center gap-2 px-2 pt-2">
              <Button type="button" variant="ghost" size="sm" className="gap-1 lg:hidden" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
                Playlists
              </Button>
              {selected ? (
                <>
                  <h2 className="text-lg font-semibold">{selected.title}</h2>
                  <Badge variant="secondary">{selected.visibility}</Badge>
                  {selected.isPrimary ? <Badge variant="outline">primary</Badge> : null}
                  <div className="ml-auto flex flex-wrap gap-2">
                    {publicSongsHref ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href={publicSongsHref}>Public page</Link>
                      </Button>
                    ) : null}
                    <form action={deleteMoodPlaylistAction}>
                      <input type="hidden" name="playlistId" value={selected.id} />
                      <Button type="submit" variant="destructive" size="sm">
                        Delete
                      </Button>
                    </form>
                  </div>
                </>
              ) : (
                <h2 className="text-lg font-semibold">New playlist</h2>
              )}
            </div>
          ) : undefined
        }
      >
        {creating ? (
          <div className="mx-auto w-full max-w-lg px-3 py-6">
            <NewPlaylistForm
              embedded
              redirectBase={profileSongsPath}
              onCreated={(id) => {
                setCreating(false)
                selectPlaylist(id)
                router.refresh()
              }}
            />
          </div>
        ) : selected ? (
          <div className="mx-auto w-full max-w-3xl space-y-6 px-3 py-4">
            <p className="text-xs text-muted-foreground">
              Embed:{' '}
              <code className="rounded bg-muted px-1">
                {`<ring-mood-player playlist="${selected.id}"></ring-mood-player>`}
              </code>
            </p>
            {playableCount(selected) > 0 ? (
              <MoodPlayer key={`preview-${selected.id}`} playlist={selected} compact showLyrics={false} />
            ) : null}
            <PlaylistEditor
              key={selected.id}
              playlist={selected}
              onSaved={() => {
                router.refresh()
              }}
            />
          </div>
        ) : (
          <div className="flex min-h-[320px] flex-1 flex-col items-center justify-center px-6 text-center">
            <Music2 className="mb-4 h-10 w-10 text-muted-foreground/60" aria-hidden />
            <h2 className="text-sm font-medium">Your healing playlists</h2>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Create a playlist, upload or generate mood arrangements, then share on your public
              songs page or embed in news.
            </p>
            <Button type="button" className="mt-6 gap-1" onClick={startCreate}>
              <Plus className="h-4 w-4" />
              New playlist
            </Button>
            {playlists.length > 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Or pick a playlist from the rail
              </p>
            ) : null}
          </div>
        )}
      </DavinciCenterPane>
    </RingRightRailLayout>
  )
}
