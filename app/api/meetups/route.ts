import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/database'

/** Lightweight meetup list for RSVP compose picker (TD-UX-01). */
export async function GET(request: NextRequest) {
  await connection()

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const limitRaw = Number(request.nextUrl.searchParams.get('limit') || '30')
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 50) : 30

  const result = await db().queryDocs({
    collection: 'meetups',
    orderBy: [{ field: 'created_at', direction: 'desc' }],
    pagination: { limit },
  })

  if (!result.success) {
    return NextResponse.json({ error: 'Failed to load meetups' }, { status: 500 })
  }

  const meetups = (result.data ?? []).map((row) => ({
    id: row.id,
    title: String(row.title ?? ''),
    date_time: row.date_time ? String(row.date_time) : undefined,
    location_name: row.location_name ? String(row.location_name) : undefined,
  }))

  return NextResponse.json({ meetups, items: meetups })
}
