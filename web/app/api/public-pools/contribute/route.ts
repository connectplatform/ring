import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { queryString, readJsonBody } from '@/lib/server/request'
import { PublicPoolContributeRequestSchema } from '@/lib/zod/public-pool-schemas'
import {
  contributeToPool,
  PublicPoolEscrowNotAvailableError,
} from '@/features/public-pools/services/public-pool-service'

export async function POST(request: NextRequest) {
  await connection()

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const slug = queryString(request, 'slug')
  if (!slug) {
    return NextResponse.json({ error: 'Missing slug query parameter' }, { status: 400 })
  }

  const body = await readJsonBody(request)
  const parsed = PublicPoolContributeRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const result = await contributeToPool({
      poolSlug: slug,
      userId: session.user.id,
      userRole: session.user.role,
      amountNativeToken: parsed.data.amount_native,
      idempotencyKey: parsed.data.idempotency_key,
      fundingMode: parsed.data.funding_mode,
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof PublicPoolEscrowNotAvailableError) {
      return NextResponse.json({ error: error.message, code: 'ESCROW_NOT_AVAILABLE' }, { status: 501 })
    }
    const message = error instanceof Error ? error.message : 'Contribution failed'
    const status = message.includes('Sign in')
      ? 403
      : message.includes('wallet')
        ? 404
        : 400
    return NextResponse.json({ error: message }, { status })
  }
}
