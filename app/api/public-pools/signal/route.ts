import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { queryString } from '@/lib/server/request'
import { togglePoolLike } from '@/features/public-pools/services/public-pool-service'

export async function POST(request: NextRequest) {
  await connection()

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const slug = queryString(request, 'slug')
  if (!slug) {
    return NextResponse.json({ error: 'Missing slug query parameter' }, { status: 400 })
  }

  try {
    const stats = await togglePoolLike(slug, session.user.id, session.user.role)
    return NextResponse.json(stats)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to toggle like'
    const status = message.includes('Sign in') ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
