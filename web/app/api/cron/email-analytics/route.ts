import { NextRequest, NextResponse } from 'next/server'
import { connection } from 'next/server'
import { ProcessConductor } from '@/lib/processes'
import { getPipelineDefinition } from '@/lib/processes/registry'

// Handle POST requests to trigger the email-analytics cron task
export async function POST(request: NextRequest) {
  // Establish a database or service connection that is required for pipeline operations
  await connection()

  // Check for presence of secret for authentication, and ensure authorization header matches
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    // If authentication fails, return a 401 Unauthorized response
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Retrieve the handler for the 'email-analytics' pipeline
  const handler = getPipelineDefinition('email-analytics')?.handler
  if (!handler) {
    // If the pipeline is not registered, return a 500 error
    return NextResponse.json({ error: 'Pipeline not registered' }, { status: 500 })
  }

  // Start and record a new 'email-analytics' cron job run using the process conductor framework
  const { result, run } = await ProcessConductor.recordRun('email-analytics', 'cron', handler)

  if (run.status === 'error') {
    // If the job errored, return a 500 response with error details and run ID
    return NextResponse.json({ success: false, error: run.error, runId: run.id }, { status: 500 })
  }

  // On success, return results and run ID for auditing or logging
  return NextResponse.json({ success: true, summary: result, runId: run.id })
}

// Handle GET requests by delegating them to the POST handler for convenience/legacy reasons
export async function GET(request: NextRequest) {
  // TODO: Consider using Next.js Route Handlers' new conventions for handling multiple HTTP methods more idiomatically.
  return POST(request)
}
