/**
 * Cron: process due vendor settlement payouts.
 * Schedule daily or hourly. Fail-closed: requires CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { connection } from 'next/server'
import { ProcessConductor } from '@/lib/processes'
import { getPipelineDefinition } from '@/lib/processes/registry'

export async function GET(request: NextRequest) {
  // Ensure the database or application connection is initialized for the request lifecycle
  await connection()

  // Retrieve CRON_SECRET from environment for request validation
  const cronSecret = process.env.CRON_SECRET

  // Reject unauthorized requests - requires correct Authorization header with the CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    // Return 401 Unauthorized on invalid or missing credentials
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Lookup handler from pipeline registry using pipeline name
    const handler = getPipelineDefinition('settlement-payout')?.handler
    if (!handler) {
      // No pipeline registered for settlement-payout, signal internal server error
      return NextResponse.json({ error: 'Pipeline not registered' }, { status: 500 })
    }

    // Run the handler within ProcessConductor context, which records the run in logs/history.
    const { result, run } = await ProcessConductor.recordRun('settlement-payout', 'cron', handler)
    // If the execution status is 'error', propagate the error message and info
    if (run.status === 'error') {
      return NextResponse.json(
        { success: false, error: run.error, runId: run.id, timestamp: new Date().toISOString() },
        { status: 500 },
      )
    }

    // Return the result of the operation along with run metadata
    return NextResponse.json({
      ...(result as object),
      runId: run.id,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    // Log and return generic or extracted error message on exception
    console.error('Cron: settlement payout failed:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

// TODO: Once Next.js 16 stable supports native Middleware-based authorization, move CRON_SECRET check to middleware to DRY up logic across all cron endpoints.
// TODO: Investigate support for more granular error codes (e.g. differentiate between missing secret and invalid secret for audit logging).
// TODO: When React 19 server components features are available, consider replacing current result object spreading with explicit serialization technique to match new conventions.