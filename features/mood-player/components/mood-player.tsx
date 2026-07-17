'use client'

import React, { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Sparkles,
  Music2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { MoodPlaylist } from '@/features/mood-player/schemas'
import {
  cycleMoodId,
  nextSongIndex,
  resolveActiveTrack,
  songHasPlayableAudio,
} from '@/features/mood-player/lib/resolve-active-track'

export type MoodPlayerProps = {
  playlist: MoodPlaylist
  className?: string
  compact?: boolean
  showLyrics?: boolean
  autoPlay?: boolean
}

export function MoodPlayer({
  playlist,
  className,
  compact = false,
  showLyrics = true,
  autoPlay = false,
}: MoodPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [songIndex, setSongIndex] = useState(0)
  const [moodId, setMoodId] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [lyricsOpen, setLyricsOpen] = useState(false)

  // Reset transport when switching playlists (e.g. PublicSongsPlayer)
  useEffect(() => {
    const songs = playlist.songs || []
    let firstPlayable = 0
    for (let i = 0; i < songs.length; i++) {
      if (songHasPlayableAudio(songs[i])) {
        firstPlayable = i
        break
      }
    }
    setSongIndex(firstPlayable)
    setMoodId(null)
    setPlaying(false)
    setLyricsOpen(false)
    // Only on playlist identity change — not on every songs[] reference churn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlist.id])

  const track = resolveActiveTrack(playlist, songIndex, moodId)
  const currentSong = playlist.songs?.[songIndex]
  const hasRoot = Boolean(currentSong?.fileUrl?.trim())
  const playableMoodCount = (currentSong?.moods || []).filter((m) => Boolean(m.fileUrl?.trim())).length
  const arrangementCount = (hasRoot ? 1 : 0) + playableMoodCount
  const canShiftMood = arrangementCount > 1
  const playableSongCount = (playlist.songs || []).filter((s) => songHasPlayableAudio(s)).length
  const canShiftSong = playableSongCount > 1

  // If current index is unplayable but others exist, jump to first playable
  useEffect(() => {
    if (track) return
    if (playableSongCount <= 0) return
    const songs = playlist.songs || []
    for (let i = 0; i < songs.length; i++) {
      if (songHasPlayableAudio(songs[i])) {
        setSongIndex(i)
        setMoodId(null)
        return
      }
    }
  }, [track, playableSongCount, playlist.songs])

  useEffect(() => {
    setMoodId(null)
  }, [songIndex])

  // Moods-only songs: sync state to the fallback mood id resolveActiveTrack picks
  useEffect(() => {
    if (!track?.moodId) return
    if (moodId !== null) return
    if (currentSong?.fileUrl?.trim()) return
    setMoodId(track.moodId)
  }, [track?.moodId, moodId, currentSong?.fileUrl])

  useEffect(() => {
    const el = audioRef.current
    if (!el || !track?.fileUrl) return
    el.src = track.fileUrl
    el.load()
    if (autoPlay || playing) {
      void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on track identity only
  }, [track?.fileUrl, track?.moodId, track?.songId])

  const togglePlay = () => {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    } else {
      el.pause()
      setPlaying(false)
    }
  }

  const shiftSong = (delta: number) => {
    setSongIndex((i) => nextSongIndex(playlist, i, delta))
    setPlaying(true)
  }

  const shiftMood = () => {
    if (!currentSong || !canShiftMood) return
    setMoodId((prev) => cycleMoodId(currentSong, prev))
    setPlaying(true)
  }

  if (!track) {
    return (
      <div className={cn('rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground', className)}>
        This playlist has no playable songs yet.
      </div>
    )
  }

  return (
    <div
      className={cn(
        'ring-mood-player overflow-hidden rounded-2xl border bg-gradient-to-br from-background via-background to-muted/40 shadow-sm',
        compact ? 'p-3' : 'p-5 md:p-6',
        className
      )}
      data-playlist-id={playlist.id}
    >
      <audio
        ref={audioRef}
        preload="metadata"
        onEnded={() => {
          // Single-song playlists stop at end; multi-song advances
          if (canShiftSong) shiftSong(1)
          else setPlaying(false)
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      <div className={cn('flex gap-4', compact ? 'flex-row items-center' : 'flex-col sm:flex-row')}>
        <div
          className={cn(
            'relative shrink-0 overflow-hidden rounded-xl bg-muted',
            compact ? 'h-16 w-16' : 'h-40 w-40 sm:h-44 sm:w-44'
          )}
        >
          {track.coverUrl ? (
            <Image src={track.coverUrl} alt={track.title} fill className="object-cover" unoptimized />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <Music2 className={compact ? 'h-6 w-6' : 'h-10 w-10'} />
            </div>
          )}
          {track.videoUrl && !compact ? (
            <video
              src={track.videoUrl}
              className="absolute inset-0 h-full w-full object-cover"
              muted
              loop
              autoPlay
              playsInline
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{playlist.title}</p>
            <h3 className={cn('font-semibold leading-tight', compact ? 'text-base' : 'text-xl')}>
              {track.title}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {[track.author, track.year].filter(Boolean).join(' · ') || '—'}
              <span className="mx-2 opacity-40">|</span>
              <span className="inline-flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {track.moodName}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Previous song"
              onClick={() => shiftSong(-1)}
              disabled={!canShiftSong}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" aria-label={playing ? 'Pause' : 'Play'} onClick={togglePlay}>
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Next song"
              onClick={() => shiftSong(1)}
              disabled={!canShiftSong}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={canShiftMood ? 'secondary' : 'ghost'}
              size="sm"
              aria-label="Shift mood"
              disabled={!canShiftMood}
              onClick={shiftMood}
              className="gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Mood
            </Button>
            {showLyrics && track.lyrics ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setLyricsOpen((v) => !v)}>
                Lyrics
              </Button>
            ) : null}
          </div>

          {lyricsOpen && track.lyrics ? (
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-xs leading-relaxed">
              {track.lyrics}
            </pre>
          ) : null}
        </div>
      </div>
    </div>
  )
}
