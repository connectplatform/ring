import { NextRequest, NextResponse } from 'next/server'
import { connection } from 'next/server'
import { ProcessConductor } from '@/lib/processes'
import { getPipelineDefinition } from '@/lib/processes/registry'

/**
 * Cron: mint approved referral rewards on-chain.
 * Protect with CRON_SECRET (Bearer token) — same pattern as cleanup-usernames.
 */
export async function GET(request: NextRequest) {
  // Ensure database or application connection is established before proceeding.
  await connection()

  try {
    // Retrieve the Authorization header from the request.
    const authHeader = request.headers.get('authorization')
    // Retrieve the expected CRON_SECRET from environment variables.
    const cronSecret = process.env.CRON_SECRET

    // Fail closed: this endpoint is unavailable if the secret is not configured, or if the token is missing or incorrect.
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      // Respond with 401 if not authorized.
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Attempt to load the pipeline definition using its registry key.
    // If not registered, .handler will be undefined.
    const handler = getPipelineDefinition('refcodes-mint')?.handler
    if (!handler) {
      // Respond with error if the pipeline is not registered.
      return NextResponse.json({ error: 'Pipeline not registered' }, { status: 500 })
    }

    // Record the 'refcodes-mint' cron run and execute the pipeline handler.
    // This returns both the result and run meta (e.g., status & id).
    const { result, run } = await ProcessConductor.recordRun('refcodes-mint', 'cron', handler)

    // If there is an error status, include it in the response and fail with 500.
    if (run.status === 'error') {
      return NextResponse.json(
        {
          success: false,
          error: run.error,     // Any error from the pipeline handler.
          runId: run.id,        // Unique cron run identifier.
          timestamp: new Date().toISOString(),
        },
        { status: 500 },
      )
    }

    // On success, return the result plus metadata.
    return NextResponse.json({
      ...(result as object),
      runId: run.id,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    // Log any unexpected server errors for monitoring.
    console.error('Cron refcodes-mint failed:', error)
    return NextResponse.json(
      {
        success: false,
        // Provide a message for known error types, otherwise default to 'Unknown error'.
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

// TODO: In Next.js 13/14+/16+ with App Router, consider extracting logic into middleware for better security composability (e.g., shared bearer auth for all cron routes).
// TODO: Use new Next.js Route Handlers patterns, e.g., error handling with new Response types or improved middleware once stable.
// TODO: Consider updating .env secrets reading to use Next.js configs if available for edge runtimes.