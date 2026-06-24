import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { listAbuseCandidates } from '@/features/fraud/services/fraud-abuse-scoring'

/**
 * GET /api/admin/fraud/candidates
 */
export async function GET(request: NextRequest) {
  await connection()

  const session = await auth()
  if (!session?.user || !isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 50)))
  const minScore = Math.max(0, Number(searchParams.get('minScore') || 1))

  try {
    const candidates = await listAbuseCandidates({ limit, minScore })
    return NextResponse.json({ success: true, candidates })
  } catch (error) {
    console.error('GET /api/admin/fraud/candidates:', error)
    return NextResponse.json({ error: 'Failed to load fraud candidates' }, { status: 500 })
  }
}
