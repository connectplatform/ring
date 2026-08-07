import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { taskEscrowService } from '@/features/tasks/services/task-escrow-service'
import { MessageService } from '@/features/chat/services/message-service'
import { parseTaskMetadata } from '@/features/tasks/types'

export async function GET(_request: NextRequest) {
  await connection()
  const session = await auth()
  if (!session?.user?.id || !isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Admin required' }, { status: 403 })
  }

  const escrows = await taskEscrowService.listAdminHeld(200)
  const messages = new MessageService()

  const rows = await Promise.all(
    escrows.map(async (escrow) => {
      const message = await messages.getMessage(escrow.messageId)
      const meta = message ? parseTaskMetadata(message) : null
      return {
        ...escrow,
        taskStatus: meta?.status ?? null,
        disputed: meta?.status === 'disputed',
        messagePreview: message?.content?.slice(0, 160) ?? '',
      }
    }),
  )

  const filtered = rows.filter((row) => row.paymentStatus === 'held' || row.disputed)

  return NextResponse.json({ success: true, escrows: filtered })
}
