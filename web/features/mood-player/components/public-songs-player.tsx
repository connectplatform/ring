'use client'

import { useEffect, useMemo, useState } from 'react'
import { MoodPlayer } from '@/features/mood-player/components/mood-player'
import type { MoodPlaylist } from '@/features/mood-player/schemas'
import { cn } from '@/lib/utils'

export function PublicSongsPlayer({
  playlists,
  initialId,
}: {
  playlists: MoodPlaylist[]
  initialId?: string
}) {
  const initial = useMemo(() => {
    if (!playlists.length) return null
    return playlists.find((p) => p.id === initialId) || playlists.find((p) => p.isPrimary) || playlists[0]
  }, [playlists, initialId])

  const [activeId, setActiveId] = useState(initial?.id || '')

  // Keep selection valid when the playlist list / primary changes
  useEffect(() => {
    if (!playlists.length) {
      setActiveId('')
      return
    }
    if (activeId && playlists.some((p) => p.id === activeId)) return
    setActiveId(initial?.id || playlists[0].id)
  }, [playlists, initial?.id, activeId])

  const active = playlists.find((p) => p.id === activeId) || initial

  if (!active) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
        No public mood playlists yet.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <MoodPlayer key={active.id} playlist={active} showLyrics />
      {playlists.length > 1 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Playlists</h2>
          <ul className="space-y-2">
            {playlists.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(p.id)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition hover:bg-muted/50',
                    p.id === active.id && 'border-primary bg-muted/40'
                  )}
                >
                  <span>
                    {p.title}
                    {p.isPrimary ? (
                      <span className="ml-2 text-xs text-muted-foreground">primary</span>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {p.id === active.id ? 'playing' : 'play'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
