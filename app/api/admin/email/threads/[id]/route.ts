import { NextRequest, NextResponse, connection } from 'next/server'
import { requireEmailAdmin } from '@/features/email-crm/lib/admin-auth'
import { EmailThreadService } from '@/features/email-crm/services/email-thread-service'
import { EmailMessageService } from '@/features/email-crm/services/email-message-service'
import { getEmailDraftService } from '@/services/email/drafts/draft-service'
import { getEmailTaskService } from '@/services/email/crm/task-service'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connection()
  const authResult = await requireEmailAdmin()
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { id } = await params
  const thread = await EmailThreadService.getThread(id)
  if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 })

  const messages = await EmailMessageService.listByThread(id)
  const drafts = await getEmailDraftService().getThreadDrafts(id)
  const tasks = await getEmailTaskService().getThreadTasks(id)

  return NextResponse.json({ thread, messages, drafts, tasks })
}
