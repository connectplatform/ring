import { NextResponse } from 'next/server'
import { connection } from 'next/server'
import { requireSuperadminApi } from '@/lib/auth/superadmin-api-guard'
import { ProcessConductor } from '@/lib/processes'

// GET handler for listing all available process pipelines
export async function GET() {
  // Establish DB or service connection required for operation
  await connection()

  // Superadmin authentication/authorization guard
  const guard = await requireSuperadminApi()
  if (guard.ok === false) {
    // If authentication fails, return the guard's error response
    return guard.response
  }

  try {
    // Attempt to fetch list of pipelines managed by ProcessConductor
    const pipelines = await ProcessConductor.listPipelines()
    // Respond with success flag and pipelines data as JSON
    return NextResponse.json({ success: true, pipelines })
  } catch (error) {
    // Catch any errors and respond with a 500 status and error message
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 },
    )
  }
}

// TODO: Consider using Next.js 16 Route Handlers' improved error handling (middleware-level or ErrorBoundary/style) for nicer error surfaces.
// TODO: If possible, use streaming responses (React19/Next16) for large dataset pagination or incremental rendering.
// TODO: Consider moving connection/auth guards to Next.js 16 Middleware if identical logic is used across handlers.