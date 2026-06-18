import { NextResponse, connection } from 'next/server'
import { getEntityAnalytics } from '@/features/entities/services/get-entity-analytics'
import { EntityAuthError, EntityPermissionError } from '@/lib/errors'
import { RouteHandlerProps } from '@/types/next-page'

/**
 * GET /api/entities/{id}/analytics — entity performance metrics (owner, member, or admin).
 */
export async function GET(
  _req: Request,
  context: RouteHandlerProps<{ id: string }>,
) {
  await connection()

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: 'Invalid ID parameter' }, { status: 400 })
  }

  try {
    const analytics = await getEntityAnalytics(id)
    return NextResponse.json(analytics, { status: 200 })
  } catch (error) {
    if (error instanceof EntityAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof EntityPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
