import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { searchUsers } from '@/features/auth/services/search-users'
import { z } from 'zod'

const searchSchema = z.object({
  q: z.string().trim().min(2).max(64),
  limit: z.coerce.number().int().min(1).max(20).optional(),
})

export async function GET(request: NextRequest) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const parsed = searchSchema.safeParse({
      q: searchParams.get('q') ?? '',
      limit: searchParams.get('limit') ?? undefined,
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const results = await searchUsers(parsed.data.q, parsed.data.limit ?? 8)

    return NextResponse.json({
      success: true,
      data: results,
    })
  } catch (error) {
    console.error('GET /api/users/search failed:', error)
    return NextResponse.json({ error: 'Failed to search users' }, { status: 500 })
  }
}
