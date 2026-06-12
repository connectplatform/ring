import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/database'

type CitationRow = Record<string, unknown> & { id: string }

/**
 * POST /api/citations/lookup
 *
 * Cross-reference detected citation DOIs and full texts against the saved
 * citations library. Returns which DOIs (or text IDs) have a saved record.
 *
 * Body: { dois: string[], texts: string[] }
 * Response: { matchedDois: string[] }
 */
export async function POST(req: NextRequest) {
  await connection()

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { dois?: string[]; texts?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const dois = Array.isArray(body.dois) ? body.dois.filter(Boolean) : []

  if (dois.length === 0) {
    return NextResponse.json({ matchedDois: [] })
  }

  try {
    // Query citations table: data->>'doi' = ANY($1)
    // The PostgreSQL adapter maps field 'doi' → data->>'doi' for JSONB tables.
    const result = await db().findDocs<CitationRow>('citations', [
      { field: 'doi', operator: 'in', value: dois }
    ])

    if (!result.success) {
      console.error('[citations/lookup] DB query failed:', result.error?.message)
      return NextResponse.json({ matchedDois: [] })
    }

    const matchedDois = (result.data ?? [])
      .map((doc) => (doc.doi as string) ?? null)
      .filter(Boolean) as string[]

    return NextResponse.json({ matchedDois }, {
      headers: { 'Cache-Control': 'no-store' }
    })
  } catch (err) {
    console.error('[citations/lookup] Unexpected error:', err)
    return NextResponse.json({ matchedDois: [] })
  }
}
