import { NextRequest, NextResponse } from 'next/server'
// TODO: When available, prefer using `request.nextUrl` or `URLSearchParams` directly for query parsing (Next.js 13+/16+ best practices)
import { connection } from 'next/server'
import { requireSuperadminApi } from '@/lib/auth/superadmin-api-guard'
import { ProcessConductor } from '@/lib/processes'

// Handles GET requests to retrieve the run history for a process, by id.
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  // 1. Establish database or backend connection before processing
  await connection() // Ensure db connection before proceeding (critical for backend ops)

  // 2. Guard: Require superadmin privileges for API access
  const guard = await requireSuperadminApi()
  if (guard.ok === false) {
    // Authorization failure: Return response as provided by the guard (likely 401/403)
    return guard.response
  }

  // 3. Extract the process id from route/context parameters
  // NOTE: In Next.js 13+, context.params may already be non-Promise. If possible, refactor for direct destructure.
  // TODO: If context.params is always direct, remove `await` here for clarity+perf.
  const { id } = await context.params

  // 4. Parse 'limit' query parameter (default 20), clamp between 1-100 for safety.
  // - Prevents fetching an unreasonable amount of data from DB.
  // - Uses built-in `request.nextUrl` from Next.js when available (Next 13+/16+) for more robust parsing.
  // TODO: Prefer `request.nextUrl.searchParams` if available, otherwise fallback to legacy.
  // Implementation using native Next.js 13+ API:
  let limit = 20 // default
  // If Next.js supports request.nextUrl:
  if (
    request.nextUrl && request.nextUrl.searchParams
  ) {
    limit = Math.max(1, Math.min(100, Number(request.nextUrl.searchParams.get('limit') ?? '20')))
  }

  try {
    // 5. Retrieve the historical runs for the given process id, up to `limit`
    // STUB: If ProcessConductor.getRunHistory is a mock, implement with: 
    //       1. Validate id exists in DB, 2. Fetch run history table by id w/limit, 3. Sort desc by run time, 4. Return result.
    const runs = await ProcessConductor.getRunHistory(id, limit)

    // 6. Compose successful JSON response including process (pipeline) id and the runs data
    return NextResponse.json({ success: true, pipelineId: id, runs })
  } catch (error) {
    // 7. Handle errors: return 500 and expose error message if possible (for debugging/admin)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
