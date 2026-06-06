import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import {
  listPublicationsByUserId,
  createPublication
} from '@/features/publications/services/publication-service'

/**
 * GET /api/publications – list current user's publications
 */
export async function GET() {
  await connection()
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const result = await listPublicationsByUserId(session.user.id)
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? 'Failed to list' }, { status: 500 })
    }
    return NextResponse.json({ data: result.data })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/publications – create a new publication
 */
export async function POST(request: NextRequest) {
  await connection()
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json().catch(() => ({}))
    const result = await createPublication(session.user.id, {
      title: body.title,
      content: body.content,
      status: body.status,
      template_id: body.template_id
    })
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? 'Failed to create' }, { status: 500 })
    }
    return NextResponse.json({ data: result.data })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    )
  }
}
