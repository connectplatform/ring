/**
 * Cron Job: Cleanup Expired Username Reservations
 * 
 * Vercel Cron: Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/cleanup-usernames",
 *     "schedule": "every 5 minutes"
 *   }]
 * }
 * 
 * Or use external cron (GitHub Actions, etc) to hit this endpoint every 5 minutes
 * 
 * PROPAGATED FROM: ring-greenfood-live (2025-11-07)
 * FEATURE: Automatic cleanup of expired username reservations
 */

import { NextRequest, NextResponse } from 'next/server'
import { connection } from 'next/server'
import { ProcessConductor } from '@/lib/processes'
import { getPipelineDefinition } from '@/lib/processes/registry'


export async function GET(request: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering (uses request.headers)

  try {
    // Verify cron authorization (Vercel Cron secret or custom auth)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Execute cleanup
    const handler = getPipelineDefinition('cleanup-usernames')?.handler
    if (!handler) {
      return NextResponse.json({ error: 'Pipeline not registered' }, { status: 500 })
    }

    const { result, run } = await ProcessConductor.recordRun('cleanup-usernames', 'cron', handler)
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

    const payload = result as { cleaned?: number; duration?: number }
    console.log(
      `Cron: Cleaned ${payload.cleaned ?? 0} expired username reservations in ${payload.duration ?? 0}ms`,
    )

    return NextResponse.json({
      ...(result as object),
      runId: run.id,
      timestamp: new Date().toISOString(),
    })
    
  } catch (error) {
    console.error('Cron: Username cleanup failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

