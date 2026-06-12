import { NextRequest, NextResponse } from 'next/server'
import { connection } from 'next/server'
import { processApprovedRewards } from '@/features/refcodes/services/reward-minter'

/**
 * Cron: mint approved referral rewards on-chain.
 * Protect with CRON_SECRET (Bearer token) — same pattern as cleanup-usernames.
 */
export async function GET(request: NextRequest) {
  await connection()

  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // Fail closed: route is unusable until CRON_SECRET is configured.
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const startTime = Date.now()
    const result = await processApprovedRewards(20)
    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      ...result,
      duration,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Cron refcodes-mint failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
