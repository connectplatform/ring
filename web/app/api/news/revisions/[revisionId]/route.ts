/**
 * GET/PATCH /api/news/revisions/[revisionId] — view / accept | reject
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getRevisionForViewer,
  resolveRevision,
} from '@/features/news/services/revision-service'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ revisionId: string }> },
) {
  const { revisionId } = await params
  const result = await getRevisionForViewer(revisionId)
  if (!result.success || !result.data) {
    return NextResponse.json(
      { success: false, error: result.error || 'Not found' },
      { status: result.httpStatus || 404 },
    )
  }
  return NextResponse.json({ success: true, data: result.data })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ revisionId: string }> },
) {
  const { revisionId } = await params
  let body: { action?: 'accept' | 'reject' }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }
  if (body.action !== 'accept' && body.action !== 'reject') {
    return NextResponse.json(
      { success: false, error: 'action must be accept or reject' },
      { status: 400 },
    )
  }

  const result = await resolveRevision(revisionId, body.action)
  if (!result.success) {
    const status =
      result.error === 'Unauthorized'
        ? 401
        : result.error === 'Forbidden'
          ? 403
          : result.error === 'Not found' || result.error === 'Revision not found'
            ? 404
            : 400
    return NextResponse.json({ success: false, error: result.error }, { status })
  }

  return NextResponse.json({ success: true, data: result.data })
}
