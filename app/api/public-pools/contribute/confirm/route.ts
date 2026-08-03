import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { readJsonBody } from '@/lib/server/request'
import { getPublicPoolConfig } from '@/lib/ring-config-core'
import { PublicPoolContributeConfirmSchema } from '@/lib/zod/public-pool-schemas'
import {
  findContributionByIdempotency,
  readPoolById,
  updateContribution,
} from '@/features/public-pools/lib/public-pool-db'
import {
  getPoolStatsBySlug,
  recomputePoolTotals,
} from '@/features/public-pools/services/public-pool-service'

/** External-wallet confirmation path — verifies tx then marks contribution confirmed. */
export async function POST(request: NextRequest) {
  await connection()

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await readJsonBody(request)
  const parsed = PublicPoolContributeConfirmSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const contribution = await findContributionByIdempotency(
    getPublicPoolConfig().cloneId,
    parsed.data.idempotency_key,
  )

  if (!contribution) {
    return NextResponse.json({ error: 'Contribution not found' }, { status: 404 })
  }

  if (contribution.user_id !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (contribution.status === 'confirmed') {
    const pool = await readPoolById(contribution.pool_id)
    if (!pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
    }
    const stats = await getPoolStatsBySlug(pool.pool_slug, session.user.id)
    return NextResponse.json({ stats, tx_hash: contribution.tx_hash })
  }

  // v1: full verification via RPC deferred — accept tx_hash for pending external flows
  await updateContribution(contribution.id, {
    status: 'confirmed',
    tx_hash: parsed.data.tx_hash,
  })

  await recomputePoolTotals(contribution.pool_id)
  const pool = await readPoolById(contribution.pool_id)
  if (pool) {
    try {
      const { refreshOpenDaoJarMessages } = await import(
        '@/features/chat/lib/refresh-open-dao-jar-messages'
      )
      await refreshOpenDaoJarMessages(pool.pool_slug, {
        contributorUserId: session.user.id,
        lastContribution: {
          userId: session.user.id,
          amountNativeToken: contribution.amount_native,
          rail: 'native_token',
          at: new Date().toISOString(),
        },
      })
    } catch {
      // Non-fatal snapshot sync
    }
  }
  const stats = pool
    ? await getPoolStatsBySlug(pool.pool_slug, session.user.id)
    : null

  return NextResponse.json({ stats, tx_hash: parsed.data.tx_hash })
}
