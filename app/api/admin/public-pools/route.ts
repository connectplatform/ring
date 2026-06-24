import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { readJsonBody } from '@/lib/server/request'
import { createAdminPublicPool, listPublicPools } from '@/features/public-pools/services/public-pool-service'
import { PublicPoolAdminCreateSchema } from '@/lib/zod/public-pool-schemas'

export async function GET() {
  await connection()

  const session = await auth()
  if (!session?.user?.id || !isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const pools = await listPublicPools({ limit: 200 })
  return NextResponse.json({ pools })
}

export async function POST(request: NextRequest) {
  await connection()

  const session = await auth()
  if (!session?.user?.id || !isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await readJsonBody(request)
  const parsed = PublicPoolAdminCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const pool = await createAdminPublicPool(parsed.data)
    return NextResponse.json({ pool }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create pool'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
