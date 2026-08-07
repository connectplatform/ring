import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { z } from 'zod'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { taskEscrowService } from '@/features/tasks/services/task-escrow-service'
import { cancelAndRefundTaskEscrow } from '@/features/tasks/services/cancel-refund-escrow'
import { MessageService } from '@/features/chat/services/message-service'
import { parseTaskMetadata } from '@/features/tasks/types'

const patchSchema = z.object({
  action: z.enum(['release', 'refund', 'cancel']),
})

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connection()
  const session = await auth()
  if (!session?.user?.id || !isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Admin required' }, { status: 403 })
  }

  const { id } = await context.params
  const escrow = await taskEscrowService.getById(id)
  if (!escrow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const messages = new MessageService()
  const message = await messages.getMessage(escrow.messageId)
  const meta = message ? parseTaskMetadata(message) : null

  return NextResponse.json({
    success: true,
    escrow,
    message,
    meta,
  })
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connection()
  const session = await auth()
  if (!session?.user?.id || !isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Admin required' }, { status: 403 })
  }

  const { id } = await context.params
  const body = patchSchema.parse(await request.json())

  if (body.action === 'release') {
    try {
      await taskEscrowService.adminResolve(id, 'release', session.user.id)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Release failed' },
        { status: 400 },
      )
    }
  } else if (body.action === 'refund') {
    try {
      await taskEscrowService.adminResolve(id, 'refund', session.user.id)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Refund failed' },
        { status: 400 },
      )
    }
  } else {
    const result = await cancelAndRefundTaskEscrow(id, session.user.id)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
  }

  const escrow = await taskEscrowService.getById(id)
  return NextResponse.json({ success: true, escrow })
}
