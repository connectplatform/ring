import 'server-only'

import { cache } from 'react'
import { randomUUID } from 'crypto'
import { db, initializeDatabase } from '@/lib/database'
import {
  moodPlaylistSchema,
  moodPlaylistUpdateSchema,
  type MoodPlaylist,
  type PlaylistSong,
} from './schemas'

const COLLECTION = 'mood_playlists'

function nowIso() {
  return new Date().toISOString()
}

function normalizePlaylist(row: Record<string, unknown> & { id?: string }): MoodPlaylist {
  const parsed = moodPlaylistSchema.safeParse({
    ...row,
    id: row.id || (row as { _id?: string })._id,
    songs: Array.isArray(row.songs) ? row.songs : [],
  })
  if (!parsed.success) {
    throw new Error(`Invalid mood playlist: ${parsed.error.message}`)
  }
  return parsed.data
}

export function createEmptySong(partial?: Partial<PlaylistSong>): PlaylistSong {
  return {
    id: partial?.id || randomUUID(),
    fileUrl: partial?.fileUrl || '',
    fileId: partial?.fileId,
    meta: {
      title: partial?.meta?.title || 'Untitled',
      author: partial?.meta?.author,
      year: partial?.meta?.year,
      coverUrl: partial?.meta?.coverUrl,
      videoUrl: partial?.meta?.videoUrl,
      lyrics: partial?.meta?.lyrics,
      source: partial?.meta?.source || 'upload',
    },
    moods: partial?.moods || [],
  }
}

export const getMoodPlaylistById = cache(async (id: string): Promise<MoodPlaylist | null> => {
  await initializeDatabase()
  const r = await db().readDoc<MoodPlaylist>(COLLECTION, id)
  if (!r.success || !r.data) return null
  try {
    return normalizePlaylist({ ...(r.data as unknown as Record<string, unknown>), id })
  } catch {
    return null
  }
})

export async function listMoodPlaylistsByOwner(ownerId: string): Promise<MoodPlaylist[]> {
  await initializeDatabase()
  const r = await db().queryDocs<MoodPlaylist>({
    collection: COLLECTION,
    filters: [{ field: 'ownerId', operator: '==', value: ownerId }],
    orderBy: [{ field: 'updatedAt', direction: 'desc' }],
    pagination: { limit: 100 },
  })
  if (!r.success || !r.data) return []
  return r.data
    .map((row) => {
      try {
        return normalizePlaylist(row as unknown as Record<string, unknown>)
      } catch {
        return null
      }
    })
    .filter((p): p is MoodPlaylist => !!p)
}

/**
 * Public playlists for a profile page — keyed by ownerId (authoritative).
 * Username denorm on the doc is best-effort and may be missing on older rows.
 */
export async function listPublicPlaylistsForOwner(ownerId: string): Promise<MoodPlaylist[]> {
  await initializeDatabase()
  if (!ownerId) return []

  const r = await db().queryDocs<MoodPlaylist>({
    collection: COLLECTION,
    filters: [
      { field: 'ownerId', operator: '==', value: ownerId },
      { field: 'visibility', operator: '==', value: 'public' },
    ],
    orderBy: [{ field: 'updatedAt', direction: 'desc' }],
    pagination: { limit: 50 },
  })
  if (!r.success || !r.data) return []
  return r.data
    .map((row) => {
      try {
        return normalizePlaylist(row as unknown as Record<string, unknown>)
      } catch {
        return null
      }
    })
    .filter((p): p is MoodPlaylist => !!p)
}

export async function getPublicPrimaryPlaylistForOwner(
  ownerId: string
): Promise<MoodPlaylist | null> {
  const rows = await listPublicPlaylistsForOwner(ownerId)
  if (!rows.length) return null
  return rows.find((p) => p.isPrimary) || rows[0] || null
}

/** @deprecated Prefer ownerId variants — username denorm is incomplete. */
export async function getPublicPrimaryPlaylistForUsername(
  username: string
): Promise<MoodPlaylist | null> {
  const handle = username.replace(/^@/, '').trim().toLowerCase()
  if (!handle) return null
  await initializeDatabase()
  const r = await db().queryDocs<MoodPlaylist>({
    collection: COLLECTION,
    filters: [
      { field: 'username', operator: '==', value: handle },
      { field: 'visibility', operator: '==', value: 'public' },
    ],
    orderBy: [{ field: 'updatedAt', direction: 'desc' }],
    pagination: { limit: 20 },
  })
  if (!r.success || !r.data?.length) return null
  const rows = r.data
    .map((row) => {
      try {
        return normalizePlaylist(row as unknown as Record<string, unknown>)
      } catch {
        return null
      }
    })
    .filter((p): p is MoodPlaylist => !!p)
  return rows.find((p) => p.isPrimary) || rows[0] || null
}

/** @deprecated Prefer listPublicPlaylistsForOwner. */
export async function listPublicPlaylistsForUsername(username: string): Promise<MoodPlaylist[]> {
  const handle = username.replace(/^@/, '').trim().toLowerCase()
  if (!handle) return []
  await initializeDatabase()
  const r = await db().queryDocs<MoodPlaylist>({
    collection: COLLECTION,
    filters: [
      { field: 'username', operator: '==', value: handle },
      { field: 'visibility', operator: '==', value: 'public' },
    ],
    orderBy: [{ field: 'updatedAt', direction: 'desc' }],
    pagination: { limit: 50 },
  })
  if (!r.success || !r.data) return []
  return r.data
    .map((row) => {
      try {
        return normalizePlaylist(row as unknown as Record<string, unknown>)
      } catch {
        return null
      }
    })
    .filter((p): p is MoodPlaylist => !!p)
}

async function clearOtherPrimaryPlaylists(ownerId: string, keepId: string): Promise<void> {
  const owned = await listMoodPlaylistsByOwner(ownerId)
  await Promise.all(
    owned
      .filter((p) => p.id !== keepId && p.isPrimary)
      .map(async (p) => {
        // Patch only primary flag — do not rewrite full playlist payload
        await db().updateDoc(COLLECTION, p.id, {
          isPrimary: false,
          updatedAt: nowIso(),
        })
      })
  )
}

export async function createMoodPlaylist(input: {
  ownerId: string
  username?: string
  title: string
  description?: string
  visibility?: MoodPlaylist['visibility']
  songs?: PlaylistSong[]
  isPrimary?: boolean
}): Promise<MoodPlaylist> {
  await initializeDatabase()
  const id = randomUUID()
  const stamp = nowIso()
  const doc: MoodPlaylist = {
    id,
    ownerId: input.ownerId,
    username: input.username?.replace(/^@/, '').trim().toLowerCase(),
    title: input.title.trim(),
    description: input.description?.trim(),
    visibility: input.visibility || 'private',
    songs: input.songs || [],
    isPrimary:
      Boolean(input.isPrimary) && (input.visibility || 'private') === 'public',
    createdAt: stamp,
    updatedAt: stamp,
  }
  const parsed = moodPlaylistSchema.parse(doc)
  const r = await db().createDoc(COLLECTION, parsed, { id })
  if (!r.success) {
    throw r.error || new Error('Failed to create mood playlist')
  }
  // Primary only applies to public playlists — private "primary" must not demote public ones
  if (parsed.isPrimary && parsed.visibility === 'public') {
    await clearOtherPrimaryPlaylists(input.ownerId, id)
  }
  return parsed
}

export async function updateMoodPlaylist(
  id: string,
  ownerId: string,
  patch: unknown
): Promise<MoodPlaylist> {
  await initializeDatabase()
  // Uncached ownership check — avoid React.cache stale read after prior writes
  const raw = await db().readDoc<MoodPlaylist>(COLLECTION, id)
  if (!raw.success || !raw.data) throw new Error('Playlist not found')
  const existing = normalizePlaylist({
    ...(raw.data as unknown as Record<string, unknown>),
    id,
  })
  if (existing.ownerId !== ownerId) throw new Error('Forbidden')

  const updates = moodPlaylistUpdateSchema.parse(patch)
  const next: MoodPlaylist = {
    ...existing,
    ...updates,
    id: existing.id,
    ownerId: existing.ownerId,
    updatedAt: nowIso(),
  }
  // Non-public playlists cannot remain primary
  if (next.visibility !== 'public') {
    next.isPrimary = false
  }
  const parsed = moodPlaylistSchema.parse(next)
  const r = await db().updateDoc(COLLECTION, id, parsed)
  if (!r.success) {
    throw r.error || new Error('Failed to update mood playlist')
  }
  if (parsed.isPrimary && parsed.visibility === 'public') {
    await clearOtherPrimaryPlaylists(ownerId, id)
  }
  return parsed
}

export async function deleteMoodPlaylist(id: string, ownerId: string): Promise<void> {
  await initializeDatabase()
  const raw = await db().readDoc<MoodPlaylist>(COLLECTION, id)
  if (!raw.success || !raw.data) throw new Error('Playlist not found')
  const existing = normalizePlaylist({
    ...(raw.data as unknown as Record<string, unknown>),
    id,
  })
  if (existing.ownerId !== ownerId) throw new Error('Forbidden')
  const r = await db().deleteDoc(COLLECTION, id)
  if (!r.success) {
    throw r.error || new Error('Failed to delete mood playlist')
  }
}

/**
 * TODO(vision): Import a track from an external URL into ring-filebase via file().
 * Stub only — do not fetch remote audio in production until security review.
 */
export async function importTrackFromUrlStub(_url: string): Promise<never> {
  throw new Error(
    'URL import is not implemented yet. Upload via file() / ring-filebase, or generate via Suno.'
  )
}
