import { NextRequest, NextResponse } from 'next/server'
import { connection } from 'next/server'
import { requireSuperadminApi } from '@/lib/auth/superadmin-api-guard'
import { ProcessConductor } from '@/lib/processes'

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }, // params is a Promise, likely due to how route handlers ingest dynamic params
) {
  // Ensure connection to DB or service before proceeding
  await connection()

  // Enforce that the user is a superadmin, or else return guard-provided error response
  const guard = await requireSuperadminApi()
  if (guard.ok === false) {
    return guard.response
  }

  // Await dynamic route param extraction
  const { id } = await context.params

  try {
    // Trigger manual process run with the pipeline/process id and the superadmin's user info
    // Fallbacks prioritize user.id, then user.email, otherwise a generic 'superadmin'
    const { run, result } = await ProcessConductor.triggerManualRun(
      id,
      guard.session.user.id ?? guard.session.user.email ?? 'superadmin',
    )

    // Respond with success indicator (based on run status), full run information, any result or error
    return NextResponse.json({
      success: run.status === 'success',
      run,
      result,
      error: run.error,
    })
  } catch (error) {
    // If something goes wrong, always return a structured error response
    // Choose a 404 if "Unknown pipeline" is in message, else 500
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('Unknown pipeline') ? 404 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

// TODO: In Next.js 16, consider using new route handler context parameter structure to directly get params without extra await if applicable.
// TODO: Consider improved error handling granularity for multiple possible ProcessConductor errors.
// TODO: If session user is always guaranteed to exist and have 'id' or 'email', refactor the fallback chain for clarity.