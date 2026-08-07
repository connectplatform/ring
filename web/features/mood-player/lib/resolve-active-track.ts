import type { ActiveMoodTrack, MoodPlaylist, PlaylistSong } from '../types'

function songTitle(song: PlaylistSong): string {
  return song.meta?.title?.trim() || 'Untitled'
}

function firstPlayableMood(song: PlaylistSong) {
  return (song.moods || []).find((m) => Boolean(m.fileUrl?.trim()))
}

export function songHasPlayableAudio(song: PlaylistSong | undefined): boolean {
  if (!song) return false
  if (song.fileUrl?.trim()) return true
  return Boolean(firstPlayableMood(song))
}

export function resolveActiveTrack(
  playlist: MoodPlaylist,
  songIndex: number,
  moodId: string | null
): ActiveMoodTrack | null {
  const songs = playlist.songs || []
  if (!songs.length) return null
  const idx = Math.max(0, Math.min(songIndex, songs.length - 1))
  const song = songs[idx]
  if (!song || !songHasPlayableAudio(song)) return null

  if (moodId && song.moods?.length) {
    const mood = song.moods.find((m) => m.id === moodId)
    if (mood?.fileUrl?.trim()) {
      return {
        songId: song.id,
        songIndex: idx,
        moodId: mood.id,
        moodName: mood.moodName || mood.meta?.moodName || 'Mood',
        fileUrl: mood.fileUrl,
        fileId: mood.fileId,
        title: mood.meta?.title || songTitle(song),
        author: mood.meta?.author || song.meta?.author,
        year: mood.meta?.year ?? song.meta?.year,
        coverUrl: mood.meta?.coverUrl || song.meta?.coverUrl,
        videoUrl: mood.meta?.videoUrl || song.meta?.videoUrl,
        lyrics: mood.meta?.lyrics || song.meta?.lyrics,
        source: mood.meta?.source || song.meta?.source,
      }
    }
  }

  // Root arrangement when present
  if (song.fileUrl?.trim()) {
    return {
      songId: song.id,
      songIndex: idx,
      moodId: null,
      moodName: 'Original',
      fileUrl: song.fileUrl,
      fileId: song.fileId,
      title: songTitle(song),
      author: song.meta?.author,
      year: song.meta?.year,
      coverUrl: song.meta?.coverUrl,
      videoUrl: song.meta?.videoUrl,
      lyrics: song.meta?.lyrics,
      source: song.meta?.source,
    }
  }

  // Moods-only song: default to first playable mood
  const fallback = firstPlayableMood(song)
  if (!fallback) return null
  return {
    songId: song.id,
    songIndex: idx,
    moodId: fallback.id,
    moodName: fallback.moodName || fallback.meta?.moodName || 'Mood',
    fileUrl: fallback.fileUrl,
    fileId: fallback.fileId,
    title: fallback.meta?.title || songTitle(song),
    author: fallback.meta?.author || song.meta?.author,
    year: fallback.meta?.year ?? song.meta?.year,
    coverUrl: fallback.meta?.coverUrl || song.meta?.coverUrl,
    videoUrl: fallback.meta?.videoUrl || song.meta?.videoUrl,
    lyrics: fallback.meta?.lyrics || song.meta?.lyrics,
    source: fallback.meta?.source || song.meta?.source,
  }
}

export function nextSongIndex(playlist: MoodPlaylist, songIndex: number, delta: number): number {
  const songs = playlist.songs || []
  const n = songs.length
  if (n <= 0) return 0

  // Prefer next playable song; fall back to modular index if none playable
  for (let step = 1; step <= n; step++) {
    const idx = (songIndex + delta * step + n * step) % n
    if (songHasPlayableAudio(songs[idx])) return idx
  }
  return (songIndex + delta + n) % n
}

export function cycleMoodId(song: PlaylistSong | undefined, currentMoodId: string | null): string | null {
  if (!song) return null
  const moods = (song.moods || []).filter((m) => Boolean(m.fileUrl?.trim()))
  if (!moods.length) return null

  const hasRoot = Boolean(song.fileUrl?.trim())
  // Cycle: (Original if root exists) → mood0 → mood1 → … → back
  if (currentMoodId === null) {
    return moods[0]?.id ?? null
  }
  const i = moods.findIndex((m) => m.id === currentMoodId)
  if (i < 0) return moods[0]?.id ?? null
  if (i >= moods.length - 1) {
    return hasRoot ? null : moods[0]?.id ?? null
  }
  return moods[i + 1]?.id ?? null
}
