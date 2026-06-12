import { NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { RefcodeService } from '@/features/refcodes/services/refcode-service'
import { ReferralRewardService } from '@/features/refcodes/services/referral-reward-service'
import { aggregateVisitStats } from '@/features/refcodes/lib/visit-analytics'
import { getReferralRewardTokenSymbol } from '@/constants/web3'

export async function GET() {
  await connection()
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const codes = await RefcodeService.listForUser(session.user.id)
    const rewards = await ReferralRewardService.listForReferrer(session.user.id)

    const stats = {
      totalRewards: rewards.length,
      minted: rewards.filter((r) => r.status === 'minted').length,
      pending: rewards.filter((r) => r.status === 'pending_approval').length,
      processing: rewards.filter((r) => r.status === 'approved' || r.status === 'minting').length,
      totalEarned: rewards
        .filter((r) => r.status === 'minted')
        .reduce((sum, r) => sum + parseFloat(r.rewardAmount || '0'), 0),
      visitStats: aggregateVisitStats(codes as unknown as Array<Record<string, unknown>>),
    }

    return NextResponse.json({
      codes,
      rewards,
      stats,
      tokenSymbol: getReferralRewardTokenSymbol(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load refcodes'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
