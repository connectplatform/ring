import { NextResponse } from 'next/server'
import { adminBlockEntity } from '@/features/entities/services/entity-moderation'
import { EntityAuthError, EntityPermissionError } from '@/lib/errors'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const entityId = String(body.entityId ?? '')
    const reason = String(body.reason ?? '')

    if (!entityId) {
      return NextResponse.json({ error: 'entityId required' }, { status: 400 })
    }

    await adminBlockEntity(entityId, reason)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof EntityAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof EntityPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Block failed' },
      { status: 500 },
    )
  }
}
