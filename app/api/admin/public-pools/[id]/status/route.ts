import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { readJsonBody } from '@/lib/server/request'
import { PublicPoolStatusUpdateSchema } from '@/lib/zod/public-pool-schemas'
import { updatePoolStatus } from '@/features/public-pools/services/public-pool-service'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connection()

  const session = await auth()
  if (!session?.user?.id || !isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await context.params
  const body = await readJsonBody(request)
  const parsed = PublicPoolStatusUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const pool = await updatePoolStatus(id, parsed.data.status)
    return NextResponse.json({ pool })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update pool status'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
