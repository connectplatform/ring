import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/database'

// CitationRow defines the expected structure of a citation document.
type CitationRow = Record<string, unknown> & { id: string }

/**
 * POST /api/citations/lookup
 *
 * Endpoint to cross-reference detected citation DOIs and full texts
 * against the saved citations library. Returns which DOIs (or text IDs)
 * have a saved record.
 *
 * Body: { dois: string[], texts: string[] }
 * Response: { matchedDois: string[] }
 */
export async function POST(req: NextRequest) {
  // Establish a database connection.
  await connection()

  // Try to authenticate the user from the session.
  const session = await auth()
  if (!session?.user?.id) {
    // Return 401 Unauthorized if user not authenticated.
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { dois?: string[]; texts?: string[] }
  try {
    // Parse the JSON request body.
    body = await req.json()
  } catch {
    // If JSON parsing fails, return 400 Bad Request.
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Ensure 'dois' is an array and remove any falsy values (e.g., null/undefined/empty string).
  const dois = Array.isArray(body.dois) ? body.dois.filter(Boolean) : []

  // If there are no DOIs to check, return an empty matchedDois array.
  if (dois.length === 0) {
    return NextResponse.json({ matchedDois: [] })
  }

  try {
    // Query the 'citations' collection for documents whose 'doi' matches any provided DOIs.
    // NOTE: The PostgreSQL adapter maps JSONB table queries to the field.
    const result = await db().findDocs<CitationRow>('citations', [
      { field: 'doi', operator: 'in', value: dois }
    ])

    if (!result.success) {
      // Log and return empty matchedDois if DB query fails.
      console.error('[citations/lookup] DB query failed:', result.error?.message)
      return NextResponse.json({ matchedDois: [] })
    }

    // Extract matched DOIs from result.
    // (result.data may be undefined; fallback to empty array.)
    // Only return DOIs that are non-falsy strings.
    const matchedDois = (result.data ?? [])
      .map((doc) => (doc.doi as string) ?? null)
      .filter(Boolean) as string[]

    // Return the matched DOIs, prevent caching.
    return NextResponse.json({ matchedDois }, {
      headers: { 'Cache-Control': 'no-store' }
    })
  } catch (err) {
    // Log unexpected errors and return empty matchedDois.
    console.error('[citations/lookup] Unexpected error:', err)
    return NextResponse.json({ matchedDois: [] })
  }

  // TODO: If/when adopting React 19/Next 16 native server actions (mutation routes),
  // consider refactoring to use typed request validation via Server Actions,
  // and consolidate authentication using the new `auth()` middleware.
  // TODO: Consider using zod or another schema validator for body parsing/validation natively with Next 16.
}
