import { NextRequest, NextResponse } from 'next/server'
import { ProcessConductor } from '@/lib/processes'
import { getPipelineDefinition } from '@/lib/processes/registry'

export async function POST(req: NextRequest) {
  // Validate cron secret from environment variable and compare with Authorization header.
  // Ensures that only requests with the correct secret can trigger the cron task.
  // TODO: Consider using Next.js middleware for global auth enforcement as of Next 16.
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Retrieve the pipeline handler specifically for 'train'
    // If not found, return error response.
    // TODO: Consider throwing from `getPipelineDefinition` to avoid manual error checks each time.
    const handler = getPipelineDefinition('train')?.handler
    if (!handler) {
      return NextResponse.json({ error: 'Pipeline not registered' }, { status: 500 })
    }

    // Record and execute the pipeline run via ProcessConductor.
    // The 'result' contains output, and 'run' carries status and metadata.
    // TODO: Investigate using native Next.js Route Handler error propagation for run.status === 'error'
    const { result, run } = await ProcessConductor.recordRun('train', 'cron', handler)

    // Handle failed run status, returning error details and run id.
    if (run.status === 'error') {
      return NextResponse.json({ ok: false, error: run.error, runId: run.id }, { status: 500 })
    }

    // On success, respond with result and run id for tracking.
    // 'result' is spread to allow handler flexibility.
    return NextResponse.json({ ...(result as object), runId: run.id })
  } catch (e) {
    // Catch all unexpected errors; log them for debugging.
    // Return a standardized failure response to caller.
    // TODO: Leverage Next.js stable error boundary handling (React 19) for improved tracking/logging.
    console.error('cron/train error', e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
