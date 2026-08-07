export type {
  MoodTrackMeta,
  MoodVariant,
  PlaylistSong,
  MoodPlaylist,
} from './schemas'

/** Active playable source resolved from song root + optional mood variant. */
export type ActiveMoodTrack = {
  songId: string
  songIndex: number
  /** null = root / original arrangement */
  moodId: string | null
  moodName: string
  fileUrl: string
  fileId?: string
  title: string
  author?: string
  year?: number | string
  coverUrl?: string
  videoUrl?: string
  lyrics?: string
  source?: 'upload' | 'generated' | 'url'
}
