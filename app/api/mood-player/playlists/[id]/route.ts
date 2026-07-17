import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getMoodPlaylistById } from '@/features/mood-player/service'

/**
 * GET /api/mood-player/playlists/[id]
 * Public/unlisted playlists for embeds; private only for owner.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const playlist = await getMoodPlaylistById(id)
  if (!playlist) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  }
  if (playlist.visibility === 'private') {
    const session = await auth()
    if (!session?.user?.id || session.user.id !== playlist.ownerId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }
  }
  return NextResponse.json({ success: true, playlist })
}
