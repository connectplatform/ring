/**
 * Cron Job: Cleanup Soft-Deleted News Articles
 *
 * Hard-purges news articles with status='deleted' that have passed
 * the 6-month forensic retention window.
 *
 * Vercel Cron: Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/cleanup-news-deleted",
 *     "schedule": "0 0 * * 0"  // weekly on Sunday midnight
 *   }]
 * }
 *
 * Or use external cron (GitHub Actions, etc) to hit this endpoint weekly.
 */

import { NextRequest, NextResponse } from 'next/server'
import { connection } from 'next/server'
import { ProcessConductor } from '@/lib/processes'
import { getPipelineDefinition } from '@/lib/processes/registry'

export async function GET(request: NextRequest) {
  await connection()

  try {
    // Authorization via CRON_SECRET
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const handler = getPipelineDefinition('cleanup-news-deleted')?.handler
    if (!handler) {
      return NextResponse.json({ error: 'Pipeline not registered' }, { status: 500 })
    }

    const { result, run } = await ProcessConductor.recordRun('cleanup-news-deleted', 'cron', handler)
    if (run.status === 'error') {
      return NextResponse.json(
        {
          success: false,
          error: run.error,
          runId: run.id,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      )
    }

    const payload = result as { purged?: number; duration?: number; note?: string }
    console.log(
      `Cron: ${payload.note ?? `Purged ${payload.purged ?? 0} articles in ${payload.duration ?? 0}ms`}`,
    )

    return NextResponse.json({
      ...(result as object),
      runId: run.id,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('Cron: News-deleted cleanup failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
