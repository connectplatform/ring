/**
 * Cron: release expired inventory reservations (inventory_reservations TTL).
 * Schedule every 5–15 minutes. Fail-closed: requires CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { connection } from 'next/server'
import { ProcessConductor } from '@/lib/processes'
import { getPipelineDefinition } from '@/lib/processes/registry'

export async function GET(request: NextRequest) {
  // Establish a DB connection (may be a noop in serverless; managed by Next)
  await connection()
  // TODO: Evaluate if connection() is redundant in Next 16/Route Handlers with native DB support.

  // Retrieve CRON_SECRET from environment and check authorization
  const cronSecret = process.env.CRON_SECRET
  // Defensive: reject if no secret OR wrong/missing header
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    // Respond unauthorized if authorization is missing/incorrect
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get pipeline (job) handler for cleanup; should be registered at boot
    const handler = getPipelineDefinition('cleanup-reservations')?.handler
    if (!handler) {
      // Fail hard if pipeline is not registered/configured
      return NextResponse.json({ error: 'Pipeline not registered' }, { status: 500 })
    }

    // Execute pipeline handler through managed process conductor; log a run
    const { result, run } = await ProcessConductor.recordRun('cleanup-reservations', 'cron', handler)
    if (run.status === 'error') {
      // If the pipeline failed, report error and details for observability
      return NextResponse.json(
        { success: false, error: run.error, runId: run.id, timestamp: new Date().toISOString() },
        { status: 500 }
      )
    }

    // Success: Merge handler result with runId and timestamp for traceability
    return NextResponse.json({
      ...(result as object),
      runId: run.id,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    // TODO: Consider adding structured logging (e.g., with request.id) for Next 16 observability
    console.error('Cron: reservation cleanup failed:', error)
    // Defensive: respond even if error is non-Error type
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
