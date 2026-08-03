import { NextResponse, connection } from 'next/server'
import { requireOrderLabAccess, labAuthDenied } from '@/features/crm/lab/lab-auth'
import { OrderSourceService } from '@/features/crm/lab/order-source-service'
import { sourceErrorResponse } from '@/features/crm/lab/order-source-errors'
import { postSourceCommitCard } from '@/features/crm/lab/order-lab-chat-service'
import { auth } from '@/auth'

/** GET /api/my-jobs/[id]/source/file?path=... — buyer/integrator/admin */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  await connection()
  const { id } = await context.params
  const access = await requireOrderLabAccess(id, { allowBuyer: true })
  if (labAuthDenied(access)) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }
  const path = new URL(request.url).searchParams.get('path')
  if (!path) {
    return NextResponse.json({ error: 'path query required' }, { status: 400 })
  }
  try {
    const file = await OrderSourceService.readFile(id, path)
    return NextResponse.json({ success: true, file, role: access.role })
  } catch (err) {
    return sourceErrorResponse(err)
  }
}

/**
 * PUT /api/my-jobs/[id]/source/file
 * Body: { path, content, message, sha? }
 * Integrator/admin only (no allowBuyer).
 */
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  await connection()
  const { id } = await context.params
  const access = await requireOrderLabAccess(id)
  if (labAuthDenied(access)) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  let body: { path?: string; content?: string; message?: string; sha?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!body.path || typeof body.content !== 'string' || !body.message) {
    return NextResponse.json(
      { error: 'path, content, and message are required' },
      { status: 400 },
    )
  }

  const session = await auth()
  try {
    const result = await OrderSourceService.commitFile(
      id,
      {
        path: body.path,
        content: body.content,
        message: body.message,
        sha: body.sha || undefined,
      },
      {
        role: access.role,
        name: session?.user?.name,
        email: session?.user?.email,
      },
    )

    void postSourceCommitCard({
      orderId: id,
      sha: result.commitSha || result.contentSha,
      path: result.path,
      message: body.message.trim(),
      actorUserId: access.userId,
      actorName: session?.user?.name,
      buyerId: access.order.userId,
      integratorId: access.order.integratorId,
    })

    return NextResponse.json({ success: true, ...result, role: access.role })
  } catch (err) {
    return sourceErrorResponse(err)
  }
}
