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
  // Establish a database or app connection as required by Next.js 16
  // This line ensures the function is not statically optimized/prerendered.
  await connection()

  try {
    // AUTHORIZATION LAYER
    // Retrieve the Authorization header from the request
    const authHeader = request.headers.get('authorization')
    // Get cron secret from environment variable
    const cronSecret = process.env.CRON_SECRET

    // If a CRON_SECRET is set, require the Authorization header to match
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Unauthorized: invalid or missing bearer token
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // CLEANUP LOGIC
    // Obtain the handler for the 'cleanup-usernames' pipeline (registration required)
    const handler = getPipelineDefinition('cleanup-usernames')?.handler
    if (!handler) {
      // Pipeline misconfiguration; handler missing
      return NextResponse.json({ error: 'Pipeline not registered' }, { status: 500 })
    }

    // Record the run via the conductor, executing the handler
    // result: The result of the handler
    // run: Info about this recorded run, including status and possible error info
    const { result, run } = await ProcessConductor.recordRun('cleanup-usernames', 'cron', handler)
    if (run.status === 'error') {
      // Handler execution failed, return error details
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

    // result is expected to contain 'cleaned' (number of cleaned reservations) and 'duration' (ms)
    const payload = result as { cleaned?: number; duration?: number }
    // Log for observability
    console.log(
      `Cron: Cleaned ${payload.cleaned ?? 0} expired username reservations in ${payload.duration ?? 0}ms`,
    )

    // Success response includes handler result, run ID, and timestamp
    return NextResponse.json({
      ...(result as object),
      runId: run.id,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    // Central error handler: log and return normalized error response
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

// TODO: Leverage Next.js 16 Middleware or built-in request validation for authorization layers.
// TODO: Consider using new Next.js 16/React 19 error reporting API for automatic error boundary wrapping in handlers.
// TODO: If the connection() call is critical, ensure it's memoized or handled at app-level for better performance and connection pooling.
// TODO: Explore if background jobs (e.g., app/api/_background functions) are preferable to HTTP endpoint for cron in the future.