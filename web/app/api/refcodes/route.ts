import { NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { RefcodeService } from '@/features/refcodes/services/refcode-service'
import { ReferralRewardService } from '@/features/refcodes/services/referral-reward-service'
import { countSignupReferrals } from '@/features/refcodes/services/attribution-service'
import { aggregateVisitStats } from '@/features/refcodes/lib/visit-analytics'
import { getReferralRewardTokenSymbol } from '@/constants/web3'
import { getCreditUnitLabel } from '@/lib/ring-config-core'

export async function GET() {
  await connection()
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const username =
      typeof session.user.username === 'string' ? session.user.username : null
    const codes = await RefcodeService.listForUser(session.user.id, username)
    const rewards = await ReferralRewardService.listForReferrer(session.user.id)
    const signupCount = await countSignupReferrals(session.user.id)

    const primary =
      codes.find((c) => c.kind === 'username') || codes[0] || null

    const stats = {
      totalRewards: rewards.length,
      minted: rewards.filter((r) => r.status === 'minted').length,
      pending: rewards.filter((r) => r.status === 'pending_approval').length,
      processing: rewards.filter((r) => r.status === 'approved' || r.status === 'minting').length,
      totalEarned: rewards
        .filter((r) => r.status === 'minted')
        .reduce((sum, r) => sum + parseFloat(r.rewardAmount || '0'), 0),
      visitStats: aggregateVisitStats(codes as unknown as Array<Record<string, unknown>>),
      signupCount,
    }

    return NextResponse.json({
      codes,
      rewards,
      stats,
      primaryTag: primary?.code || username || null,
      username,
      creditUnitLabel: getCreditUnitLabel(),
      tokenSymbol: getReferralRewardTokenSymbol(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load refcodes'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
