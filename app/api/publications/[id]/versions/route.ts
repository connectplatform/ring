import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import {
  getPublicationById,
  listVersionsByPublicationId,
  createVersion,
  updatePublication
} from '@/features/publications/services/publication-service'

/**
 * GET /api/publications/[id]/versions – list versions for a publication
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
    const { id: publicationId } = await params
    const pub = await getPublicationById(publicationId)
    if (!pub.success || !pub.data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (pub.data.data.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const result = await listVersionsByPublicationId(publicationId)
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? 'Failed to list versions' }, { status: 500 })
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
 * POST /api/publications/[id]/versions – create a version (snapshot) or restore from a version
 * Body: { action: 'snapshot' | 'restore', versionId?: string, changeSummary?: string }
 * For snapshot: saves current content as a new version (content in body optional; if not provided, use current publication content).
 * For restore: versionId required; restores publication content from that version.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connection()
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id: publicationId } = await params
    const pub = await getPublicationById(publicationId)
    if (!pub.success || !pub.data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (pub.data.data.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await request.json().catch(() => ({}))
    const action = body.action === 'restore' ? 'restore' : 'snapshot'

    if (action === 'restore') {
      const versionId = body.versionId
      if (!versionId) {
        return NextResponse.json({ error: 'versionId required for restore' }, { status: 400 })
      }
      const versionsResult = await listVersionsByPublicationId(publicationId)
      if (!versionsResult.success || !versionsResult.data) {
        return NextResponse.json({ error: 'Failed to list versions' }, { status: 500 })
      }
      const version = versionsResult.data.find((v) => v.id === versionId)
      if (!version) {
        return NextResponse.json({ error: 'Version not found' }, { status: 404 })
      }
      const updateResult = await updatePublication(publicationId, {
        content: version.data.content as Record<string, unknown>
      })
      if (!updateResult.success) {
        return NextResponse.json({ error: updateResult.error ?? 'Failed to restore' }, { status: 500 })
      }
      return NextResponse.json({ data: updateResult.data })
    }

    // snapshot: create a new version from current content or from body.content
    const content =
      body.content != null && typeof body.content === 'object'
        ? body.content
        : pub.data.data.content
    const result = await createVersion(
      publicationId,
      content,
      session.user.id,
      body.changeSummary
    )
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? 'Failed to create version' }, { status: 500 })
    }
    return NextResponse.json({ data: result.data })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    )
  }
}
