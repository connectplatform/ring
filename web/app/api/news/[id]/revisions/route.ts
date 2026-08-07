/**
 * GET/POST /api/news/[id]/revisions
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  createPendingRevision,
  listRevisionsForViewer,
} from '@/features/news/services/revision-service'
import type { NewsRevisionStatus } from '@/features/news/types/collaboration'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const status = request.nextUrl.searchParams.get('status') as NewsRevisionStatus | null
  const result = await listRevisionsForViewer(id, status || undefined)
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.httpStatus || 500 },
    )
  }
  return NextResponse.json({ success: true, data: result.data })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  let body: { proposedContent?: string; proposedJson?: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.proposedContent?.trim()) {
    return NextResponse.json(
      { success: false, error: 'proposedContent required' },
      { status: 400 },
    )
  }

  const result = await createPendingRevision({
    articleId: id,
    proposedContent: body.proposedContent,
    proposedJson: body.proposedJson,
  })

  if (!result.success) {
    const status =
      result.error === 'Unauthorized'
        ? 401
        : result.error === 'Forbidden' ||
            result.error === 'Authors should edit the article directly'
          ? 403
          : result.error === 'Article not found'
            ? 404
            : 400
    return NextResponse.json({ success: false, error: result.error }, { status })
  }

  return NextResponse.json({ success: true, data: result.data }, { status: 201 })
}
