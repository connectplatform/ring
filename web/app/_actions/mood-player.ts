'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { MediaConductor } from '@/lib/media/conductor/media-conductor'
import { billMoodMusicGeneration, priceForMoodMusic } from '@/features/mood-player/billing'
import { creditBalanceService } from '@/features/wallet/services/credit-balance-service'
import {
  createMoodPlaylist,
  deleteMoodPlaylist,
  getMoodPlaylistById,
  listMoodPlaylistsByOwner,
  updateMoodPlaylist,
  importTrackFromUrlStub,
} from '@/features/mood-player/service'
import type { MoodPlaylist, PlaylistSong } from '@/features/mood-player/schemas'
import { LEGACY_ROUTES } from '@/constants/routes'

export type MoodPlayerActionState = {
  success?: boolean
  error?: string
  playlistId?: string
  songId?: string
  moodId?: string
  url?: string
  fileId?: string
  externalId?: string
  billWarning?: string
}

async function requireUser() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) throw new Error('Unauthorized')
  return {
    userId,
    username: (session.user as { username?: string })?.username,
  }
}

export async function listMyMoodPlaylistsAction(): Promise<MoodPlaylist[]> {
  const { userId } = await requireUser()
  return listMoodPlaylistsByOwner(userId)
}

export async function createMoodPlaylistAction(
  _prev: MoodPlayerActionState | null,
  formData: FormData
): Promise<MoodPlayerActionState> {
  try {
    const { userId, username } = await requireUser()
    const title = String(formData.get('title') || '').trim()
    if (!title) return { error: 'Title is required' }
    const description = String(formData.get('description') || '').trim() || undefined
    const visibility = (String(formData.get('visibility') || 'private') as MoodPlaylist['visibility'])
    const playlist = await createMoodPlaylist({
      ownerId: userId,
      username,
      title,
      description,
      visibility,
      songs: [],
      isPrimary: formData.get('isPrimary') === 'true',
    })
    revalidatePath(LEGACY_ROUTES.PROFILE_SONGS)
    return { success: true, playlistId: playlist.id }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Create failed' }
  }
}

export async function saveMoodPlaylistAction(
  _prev: MoodPlayerActionState | null,
  formData: FormData
): Promise<MoodPlayerActionState> {
  try {
    const { userId, username } = await requireUser()
    const playlistId = String(formData.get('playlistId') || '').trim()
    if (!playlistId) return { error: 'playlistId is required' }

    const title = String(formData.get('title') || '').trim()
    const description = String(formData.get('description') || '').trim()
    const visibility = String(formData.get('visibility') || 'private') as MoodPlaylist['visibility']
    const isPrimary = formData.get('isPrimary') === 'true'
    const songsRaw = String(formData.get('songsJson') || '[]')
    let songs: PlaylistSong[] = []
    try {
      songs = JSON.parse(songsRaw) as PlaylistSong[]
    } catch {
      return { error: 'Invalid songs JSON' }
    }

    await updateMoodPlaylist(playlistId, userId, {
      title: title || undefined,
      description,
      visibility,
      isPrimary,
      // Only set when present — avoid clearing username with undefined
      ...(username ? { username } : {}),
      songs,
    })
    revalidatePath(LEGACY_ROUTES.PROFILE_SONGS)
    if (username) {
      revalidatePath(LEGACY_ROUTES.PUBLIC_PROFILE_PLAYER(username))
    }
    return { success: true, playlistId }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Save failed' }
  }
}

export async function deleteMoodPlaylistAction(formData: FormData): Promise<void> {
  const { userId } = await requireUser()
  const playlistId = String(formData.get('playlistId') || '').trim()
  if (!playlistId) throw new Error('playlistId is required')
  await deleteMoodPlaylist(playlistId, userId)
  revalidatePath(LEGACY_ROUTES.PROFILE_SONGS)
  const { redirect } = await import('next/navigation')
  redirect(LEGACY_ROUTES.PROFILE_SONGS)
}

export async function generateMoodTrackAction(
  _prev: MoodPlayerActionState | null,
  formData: FormData
): Promise<MoodPlayerActionState> {
  try {
    const { userId } = await requireUser()
    const lyrics = String(formData.get('lyrics') || '')
    const style = String(formData.get('style') || formData.get('moodName') || '').trim()
    const title = String(formData.get('title') || 'Untitled').trim()
    const playlistId = String(formData.get('playlistId') || '') || undefined
    const songId = String(formData.get('songId') || '') || undefined
    const moodId = String(formData.get('moodId') || '') || undefined
    const makeInstrumental = formData.get('makeInstrumental') === 'true'

    if (!style) return { error: 'Mood / style is required for generation' }

    // Soft gate: require balance before calling the provider (charge only after success).
    const price = priceForMoodMusic()
    const hasBalance = await creditBalanceService.hasSufficientBalance(userId, price)
    if (!hasBalance) {
      return { error: 'Insufficient credit balance for mood music generation' }
    }

    // Generate first — do not charge credits when the provider fails.
    const result = await MediaConductor.generateMoodTrack({
      lyrics,
      style,
      title,
      makeInstrumental,
      actorId: userId,
    })
    if (!result.success || !result.url) {
      return { error: result.error || 'Generation failed' }
    }

    const referenceId = `mood-music:${userId}:${playlistId || 'x'}:${songId || 'x'}:${moodId || 'root'}:${randomUUID().slice(0, 8)}`
    const bill = await billMoodMusicGeneration({
      userId,
      referenceId,
      playlistId,
      songId,
      moodId,
      provider: 'suno',
      metadata: { title, style },
    })

    return {
      success: true,
      url: result.url,
      fileId: result.fileId,
      externalId: result.externalId,
      playlistId,
      songId,
      moodId,
      billWarning: bill.success ? undefined : bill.error || 'Generated but credit debit failed',
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Generation failed' }
  }
}

/** Stub — URL import not production-ready. */
export async function importMoodTrackFromUrlAction(
  _prev: MoodPlayerActionState | null,
  formData: FormData
): Promise<MoodPlayerActionState> {
  const url = String(formData.get('url') || '').trim()
  if (!url) return { error: 'URL is required' }
  try {
    await importTrackFromUrlStub(url)
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'URL import unavailable' }
  }
}

export async function getMoodPlaylistForEmbedAction(playlistId: string): Promise<MoodPlaylist | null> {
  const playlist = await getMoodPlaylistById(playlistId)
  if (!playlist) return null
  if (playlist.visibility === 'private') {
    const session = await auth()
    if (!session?.user?.id || session.user.id !== playlist.ownerId) {
      return null
    }
  }
  return playlist
}
