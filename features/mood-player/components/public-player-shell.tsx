'use client'

/**
 * PublicPlayerShell — DaVinci-class public mood player
 * Right rail: playlists + profile options; center: flush hero + MoodPlayer
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Gamepad2,
  Images,
  Music2,
  Settings2,
  Sparkles,
} from 'lucide-react'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MoodPlayer } from '@/features/mood-player/components/mood-player'
import type { MoodPlaylist } from '@/features/mood-player/schemas'
import {
  DavinciGlassChip,
  DavinciGlassStatBlock,
  davinciCtaPrimary,
  davinciGlassSurface,
} from '@/lib/ui/davinci'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'

const INSET = 'px-4 sm:px-5 lg:px-6'
const BAND_Y = 'py-12 sm:py-14 lg:py-16'

export type PublicPlayerShellProps = {
  username: string
  displayName: string
  locale: Locale
  isOwner: boolean
  playlists: MoodPlaylist[]
  initialId?: string
}

function PublicPlayerRail({
  playlists,
  activeId,
  onSelect,
  username,
  locale,
  isOwner,
}: {
  playlists: MoodPlaylist[]
  activeId: string
  onSelect: (id: string) => void
  username: string
  locale: Locale
  isOwner: boolean
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Playlists
        </p>
        <DavinciGlassChip icon={<Music2 className="h-3.5 w-3.5" />}>
          {playlists.length} public
        </DavinciGlassChip>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <ul className="space-y-1.5 pr-2">
          {playlists.map((p) => {
            const active = p.id === activeId
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onSelect(p.id)}
                  className={cn(
                    davinciGlassSurface,
                    'flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition',
                    active &&
                      'border-[color-mix(in_oklch,var(--davinci-beam)_45%,transparent)] bg-[color-mix(in_oklch,var(--davinci-beam)_10%,transparent)]',
                  )}
                >
                  <span className="min-w-0 truncate font-medium">
                    {p.title}
                    {p.isPrimary ? (
                      <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                        primary
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {active ? 'now' : 'play'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </ScrollArea>

      <div className="space-y-2 border-t border-border/40 pt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          More
        </p>
        <Button variant="outline" size="sm" className="w-full justify-start" asChild>
          <Link href={ROUTES.PUBLIC_PROFILE(username, locale)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Profile
          </Link>
        </Button>
        <Button variant="outline" size="sm" className="w-full justify-start" asChild>
          <Link href={ROUTES.PUBLIC_PROFILE_GAMES(username, locale)}>
            <Gamepad2 className="mr-2 h-4 w-4" />
            Games
          </Link>
        </Button>
        <Button variant="outline" size="sm" className="w-full justify-start" asChild>
          <Link href={ROUTES.PUBLIC_PROFILE_IMG(username, locale)}>
            <Images className="mr-2 h-4 w-4" />
            Gallery
          </Link>
        </Button>
        {isOwner ? (
          <Button size="sm" className={cn(davinciCtaPrimary, 'w-full justify-start')} asChild>
            <Link href={ROUTES.PROFILE_SONGS(locale)}>
              <Settings2 className="mr-2 h-4 w-4" />
              Manage songs
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function PublicPlayerShell({
  username,
  displayName,
  locale,
  isOwner,
  playlists,
  initialId,
}: PublicPlayerShellProps) {
  const initial = useMemo(() => {
    if (!playlists.length) return null
    return (
      playlists.find((p) => p.id === initialId) ||
      playlists.find((p) => p.isPrimary) ||
      playlists[0]
    )
  }, [playlists, initialId])

  const [activeId, setActiveId] = useState(initial?.id || '')
  const [railOpen, setRailOpen] = useState(false)

  useEffect(() => {
    if (!playlists.length) {
      setActiveId('')
      return
    }
    if (activeId && playlists.some((p) => p.id === activeId)) return
    setActiveId(initial?.id || playlists[0].id)
  }, [playlists, initial?.id, activeId])

  const active = playlists.find((p) => p.id === activeId) || initial
  const songCount = active?.songs?.length ?? 0

  const rightRail = (
    <PublicPlayerRail
      playlists={playlists}
      activeId={active?.id || ''}
      onSelect={(id) => {
        setActiveId(id)
        setRailOpen(false)
      }}
      username={username}
      locale={locale}
      isOwner={isOwner}
    />
  )

  return (
    <RingRightRailLayout
      rightRailPurpose="player"
      rightRailContent={[
        { blockType: 'player-playlists' },
        { blockType: 'player-links' },
      ]}
      rightRail={rightRail}
      railWidth={300}
      flushCenterPane
      contentClassName="pb-24 lg:pb-8"
      isOpen={railOpen}
      onToggle={setRailOpen}
    >
      <DavinciCenterPane contentClassName="!p-0">
        <div className="w-full min-w-0">
          <section
            className={cn(
              BAND_Y,
              'bg-[color-mix(in_oklch,var(--davinci-beam)_8%,transparent)]',
            )}
          >
            <div className={cn('mx-auto max-w-4xl space-y-4', INSET)}>
              <p className="text-sm text-muted-foreground">
                <Link
                  href={ROUTES.PUBLIC_PROFILE(username, locale)}
                  className="hover:underline"
                >
                  @{username}
                </Link>
              </p>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="space-y-2">
                  <DavinciGlassChip icon={<Sparkles className="h-3.5 w-3.5" />}>
                    Mood player
                  </DavinciGlassChip>
                  <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                    {displayName}
                  </h1>
                  <p className="max-w-xl text-muted-foreground">
                    Same lyrics, shifting moods. Use Next/Previous for songs and Mood to
                    change arrangement.
                  </p>
                </div>
                {isOwner ? (
                  <Button className={davinciCtaPrimary} asChild>
                    <Link href={ROUTES.PROFILE_SONGS(locale)}>Manage songs</Link>
                  </Button>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:max-w-md">
                <DavinciGlassStatBlock
                  label="Playlists"
                  value={String(playlists.length)}
                  beamOnHover={false}
                />
                <DavinciGlassStatBlock
                  label="Tracks"
                  value={String(songCount)}
                  hint={active?.title}
                  beamOnHover={false}
                />
              </div>
            </div>
          </section>

          <section className={cn(BAND_Y, INSET)}>
            <div className="mx-auto max-w-4xl">
              {!active ? (
                <div
                  className={cn(
                    davinciGlassSurface,
                    'space-y-4 p-10 text-center',
                  )}
                >
                  <p className="text-muted-foreground">No public mood playlists yet.</p>
                  {isOwner ? (
                    <Button className={davinciCtaPrimary} asChild>
                      <Link href={ROUTES.PROFILE_SONGS_NEW(locale)}>
                        Create your first playlist
                      </Link>
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className={cn(davinciGlassSurface, 'p-4 sm:p-5')}>
                  <MoodPlayer key={active.id} playlist={active} showLyrics />
                </div>
              )}
            </div>
          </section>
        </div>
      </DavinciCenterPane>
    </RingRightRailLayout>
  )
}
