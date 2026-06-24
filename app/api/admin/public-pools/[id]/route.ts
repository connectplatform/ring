import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { readJsonBody } from '@/lib/server/request'
import {
  deleteAdminPublicPool,
  getPublicPoolById,
  updateAdminPublicPool,
} from '@/features/public-pools/services/public-pool-service'
import { PublicPoolAdminUpdateSchema } from '@/lib/zod/public-pool-schemas'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connection()

  const session = await auth()
  if (!session?.user?.id || !isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await context.params
  const pool = await getPublicPoolById(id)
  if (!pool) {
    return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
  }

  return NextResponse.json({ pool })
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connection()

  const session = await auth()
  if (!session?.user?.id || !isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await context.params
  const pool = await getPublicPoolById(id)
  if (!pool) {
    return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
  }

  const body = await readJsonBody(request)
  const parsed = PublicPoolAdminUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const updated = await updateAdminPublicPool(id, parsed.data)
    return NextResponse.json({ pool: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update pool'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connection()

  const session = await auth()
  if (!session?.user?.id || !isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await context.params
  const pool = await getPublicPoolById(id)
  if (!pool) {
    return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
  }

  try {
    await deleteAdminPublicPool(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete pool'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
