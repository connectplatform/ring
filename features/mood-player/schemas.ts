import { z } from 'zod'

export const moodTrackMetaSchema = z.object({
  title: z.string().optional(),
  author: z.string().optional(),
  year: z.union([z.number(), z.string()]).optional(),
  coverUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  lyrics: z.string().optional(),
  moodName: z.string().optional(),
  /** upload | generated | url (url = future import stub) */
  source: z.enum(['upload', 'generated', 'url']).optional(),
  provider: z.string().optional(),
  externalId: z.string().optional(),
})

export const moodVariantSchema = z.object({
  id: z.string().min(1),
  moodName: z.string().min(1),
  fileUrl: z.string().default(''),
  fileId: z.string().optional(),
  meta: moodTrackMetaSchema.optional(),
})

export const playlistSongSchema = z.object({
  id: z.string().min(1),
  fileUrl: z.string().default(''),
  fileId: z.string().optional(),
  meta: moodTrackMetaSchema.extend({
    title: z.string().min(1),
  }),
  moods: z.array(moodVariantSchema).optional(),
})

export const moodPlaylistSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().min(1),
  username: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  visibility: z.enum(['public', 'private', 'unlisted']).default('private'),
  songs: z.array(playlistSongSchema).default([]),
  isPrimary: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const moodPlaylistCreateSchema = moodPlaylistSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  title: z.string().min(1),
  songs: z.array(playlistSongSchema).default([]),
})

export const moodPlaylistUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  visibility: z.enum(['public', 'private', 'unlisted']).optional(),
  songs: z.array(playlistSongSchema).optional(),
  isPrimary: z.boolean().optional(),
  username: z.string().optional(),
})

export type MoodTrackMeta = z.infer<typeof moodTrackMetaSchema>
export type MoodVariant = z.infer<typeof moodVariantSchema>
export type PlaylistSong = z.infer<typeof playlistSongSchema>
export type MoodPlaylist = z.infer<typeof moodPlaylistSchema>
