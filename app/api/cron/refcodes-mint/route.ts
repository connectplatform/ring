import { NextRequest, NextResponse } from 'next/server'
import { connection } from 'next/server'
import { ProcessConductor } from '@/lib/processes'
import { getPipelineDefinition } from '@/lib/processes/registry'

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

    const handler = getPipelineDefinition('refcodes-mint')?.handler
    if (!handler) {
      return NextResponse.json({ error: 'Pipeline not registered' }, { status: 500 })
    }

    const { result, run } = await ProcessConductor.recordRun('refcodes-mint', 'cron', handler)
    if (run.status === 'error') {
      return NextResponse.json(
        {
          success: false,
          error: run.error,
          runId: run.id,
          timestamp: new Date().toISOString(),
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ...(result as object),
      runId: run.id,
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
