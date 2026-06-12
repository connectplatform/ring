import { NextRequest, NextResponse, connection } from 'next/server'
import { requireEmailAdmin } from '@/features/email-crm/lib/admin-auth'
import { getEmailDraftService } from '@/services/email/drafts/draft-service'
import { EmailThreadService } from '@/features/email-crm/services/email-thread-service'
import { sendDraftReply } from '@/features/email-crm/services/email-send-orchestrator'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connection()
  const authResult = await requireEmailAdmin()
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const body = await req.json().catch(() => ({}))
  const { id } = await params
  const draft = await getEmailDraftService().getDraft(id)
  if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })

  const thread = await EmailThreadService.getThread(draft.threadId)
  const toEmail = body.toEmail ?? thread?.fromEmail
  const subject = body.subject ?? thread?.subject ?? 'Re: your inquiry'
  if (!toEmail) {
    return NextResponse.json({ error: 'Recipient email required' }, { status: 400 })
  }

  const { messageId } = await sendDraftReply({
    draftId: id,
    toEmail,
    subject,
    threadId: draft.threadId,
    inReplyTo: draft.messageId,
    wasAutoSent: false,
  })

  return NextResponse.json({ success: true, messageId })
}
