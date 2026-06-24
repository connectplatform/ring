import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  await connection()

  const session = await auth()
  if (!session?.user || !isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const [users, entities, opportunities] = await Promise.all([
    db().countDocs('users'),
    db().countDocs('entities'),
    db().countDocs('opportunities'),
  ])

  return NextResponse.json({
    users: users.success ? (users.data ?? 0) : 0,
    entities: entities.success ? (entities.data ?? 0) : 0,
    opportunities: opportunities.success ? (opportunities.data ?? 0) : 0,
  })
}
