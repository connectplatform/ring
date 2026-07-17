import { NextRequest, NextResponse, connection } from 'next/server'
import type { Session } from 'next-auth'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import {
  getAdminRecentActivity,
  type AdminActivityFilter,
} from '@/lib/admin/recent-activity'
import { logger } from '@/lib/logger'

function canManageUsers(session: Session | null) {
  return !!session?.user && isPlatformAdmin(session.user.role)
}

const FILTERS = new Set<AdminActivityFilter>(['all', 'new_user', 'verification', 'payments', 'rewards'])

/**
 * GET /api/admin/activity?filter=all|new_user|verification|payments|rewards&limit=30
 */
export async function GET(request: NextRequest) {
  await connection()

  const session = await auth()
  if (!canManageUsers(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const rawFilter = (searchParams.get('filter') || 'all') as AdminActivityFilter
    const filter = FILTERS.has(rawFilter) ? rawFilter : 'all'
    const limit = Math.min(Number(searchParams.get('limit') || 30), 100)

    const items = await getAdminRecentActivity({ filter, limit })
    return NextResponse.json({ success: true, items })
  } catch (error) {
    logger.error('Admin activity feed failed', { error })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load activity' },
      { status: 500 },
    )
  }
}
