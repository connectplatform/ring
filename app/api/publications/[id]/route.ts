import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import {
  getPublicationById,
  updatePublication,
  deletePublication
} from '@/features/publications/services/publication-service'

/**
 * GET /api/publications/[id]
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connection()
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const result = await getPublicationById(id)
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? 'Not found' }, { status: result.data === undefined ? 404 : 500 })
    }
    if (!result.data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (result.data.data.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
 * PUT /api/publications/[id]
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connection()
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const existing = await getPublicationById(id)
    if (!existing.success || !existing.data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (existing.data.data.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await request.json().catch(() => ({}))
    const result = await updatePublication(id, {
      title: body.title,
      content: body.content,
      status: body.status,
      template_id: body.template_id
    })
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? 'Failed to update' }, { status: 500 })
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
 * DELETE /api/publications/[id]
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connection()
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const existing = await getPublicationById(id)
    if (!existing.success || !existing.data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (existing.data.data.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const result = await deletePublication(id)
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? 'Failed to delete' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    )
  }
}
