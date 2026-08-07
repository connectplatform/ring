import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  // Ensure a database connection is established before proceeding.
  await connection()

  // Authenticate the user via a server-side authentication method.
  const session = await auth()

  // If the session is invalid or the user does not have platform admin rights, deny access.
  if (!session?.user || !isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  // Query counts for users, entities, and opportunities collections concurrently.
  // TODO: If db().countDocs is I/O bound, consider using React's use() hook with server actions/hooks in Next.js 14+ for more integrated data fetching.
  const [users, entities, opportunities] = await Promise.all([
    db().countDocs('users'),
    db().countDocs('entities'),
    db().countDocs('opportunities'),
  ])

  // Retun the count for each collection, defaulting to 0 if the query failed or returned null/undefined.
  // TODO: Handle/report possible errors from countDocs for better observability.
  return NextResponse.json({
    users: users.success ? (users.data ?? 0) : 0,
    entities: entities.success ? (entities.data ?? 0) : 0,
    opportunities: opportunities.success ? (opportunities.data ?? 0) : 0,
  })
}
