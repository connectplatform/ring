import { NextResponse } from 'next/server'
import { getEntityModerationQueue } from '@/features/admin/matcher/get-entity-moderation-queue'
import { EntityPermissionError } from '@/lib/errors'

export async function GET() {
  try {
    const queue = await getEntityModerationQueue()
    return NextResponse.json({ items: queue })
  } catch (error) {
    if (error instanceof EntityPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load moderation queue' },
      { status: 500 },
    )
  }
}
