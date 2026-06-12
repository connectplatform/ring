import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { processApprovedRewards, mintReferralReward } from '@/features/refcodes/services/reward-minter'
import { z } from 'zod'

const bodySchema = z.object({
  rewardId: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
})

export async function POST(request: NextRequest) {
  await connection()
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isPlatformAdmin(session.user.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = bodySchema.parse(await request.json().catch(() => ({})))

    if (body.rewardId) {
      const result = await mintReferralReward(body.rewardId)
      return NextResponse.json(result)
    }

    const batch = await processApprovedRewards(body.limit ?? 10)
    return NextResponse.json({ success: true, ...batch })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Mint processing failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
