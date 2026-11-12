/**
 * Cron Job: Cleanup Soft-Deleted Notifications (SD6 retention)
 *
 * Hard-purges notifications with status='deleted' past the 30-day retention
 * window. Soft-delete keeps rows recoverable (undo) and hidden from
 * feeds/counts; this job bounds storage growth.
 *
 * Vercel Cron: add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/cleanup-notifications-deleted",
 *     "schedule": "0 3 * * *"  // daily at 03:00
 *   }]
 * }
 *
 * Or use external cron to hit this endpoint daily with the CRON_SECRET bearer.
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

    const handler = getPipelineDefinition('cleanup-notifications-deleted')?.handler
    if (!handler) {
      return NextResponse.json({ error: 'Pipeline not registered' }, { status: 500 })
    }

    const { result, run } = await ProcessConductor.recordRun('cleanup-notifications-deleted', 'cron', handler)
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

    return NextResponse.json(
      { ...(result as object), runId: run.id, timestamp: new Date().toISOString() },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error', timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }
}
