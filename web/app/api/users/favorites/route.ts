import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { getCurrentProjectUserDataService } from '@/features/auth/services/project-user-data-service'
import type { UserFavorite } from '@/features/auth/types'

const VALID_TYPES = new Set<UserFavorite['favoriteType']>([
  'product',
  'entity',
  'opportunity',
  'content',
  'user',
])

function parseFavoriteType(value: string | null): UserFavorite['favoriteType'] | null {
  if (!value || !VALID_TYPES.has(value as UserFavorite['favoriteType'])) {
    return null
  }
  return value as UserFavorite['favoriteType']
}

export async function GET(request: NextRequest) {
  await connection()

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const favoriteType = parseFavoriteType(searchParams.get('favoriteType'))
  const favoriteId = searchParams.get('favoriteId')?.trim()

  if (!favoriteType || !favoriteId) {
    return NextResponse.json(
      { error: 'favoriteType and favoriteId are required' },
      { status: 400 }
    )
  }

  try {
    const service = getCurrentProjectUserDataService()
    const projectSlug = process.env.NEXT_PUBLIC_PROJECT_SLUG || 'ring-platform.org'
    const favorites = await service.getUserFavorites(
      session.user.id,
      projectSlug,
      favoriteType
    )
    const favorited = favorites.some((f) => f.favoriteId === favoriteId)

    return NextResponse.json({ favorited, favoriteType, favoriteId })
  } catch (error) {
    console.error('GET /api/user/favorites:', error)
    return NextResponse.json({ error: 'Failed to load favorites' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  await connection()

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  let body: { favoriteType?: string; favoriteId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const favoriteType = parseFavoriteType(body.favoriteType ?? null)
  const favoriteId = body.favoriteId?.trim()

  if (!favoriteType || !favoriteId) {
    return NextResponse.json(
      { error: 'favoriteType and favoriteId are required' },
      { status: 400 }
    )
  }

  const globalUserId = session.user.id
  const projectSlug = process.env.NEXT_PUBLIC_PROJECT_SLUG || 'ring-platform.org'
  const service = getCurrentProjectUserDataService()

  try {
    const existing = await service.getUserFavorites(globalUserId, projectSlug, favoriteType)
    const alreadySaved = existing.some((f) => f.favoriteId === favoriteId)

    if (alreadySaved) {
      await service.removeFavorite(globalUserId, projectSlug, favoriteType, favoriteId)
      return NextResponse.json({ favorited: false, favoriteType, favoriteId })
    }

    await service.addFavorite({
      globalUserId,
      projectSlug,
      favoriteType,
      favoriteId,
    })

    return NextResponse.json({ favorited: true, favoriteType, favoriteId })
  } catch (error) {
    console.error('POST /api/user/favorites:', error)
    return NextResponse.json({ error: 'Failed to update favorite' }, { status: 500 })
  }
}
