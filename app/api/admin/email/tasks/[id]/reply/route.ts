import { NextRequest, NextResponse, connection } from 'next/server'
import { requireEmailAdmin } from '@/features/email-crm/lib/admin-auth'
import { getEmailTaskService } from '@/features/email-crm/pipeline/crm/task-service'
import { EmailThreadService } from '@/features/email-crm/services/email-thread-service'
import { EmailMessageService } from '@/features/email-crm/services/email-message-service'
import { getEmailSender } from '@/features/email-crm/pipeline/smtp'
import { logger } from '@/lib/logger'

/**
 * POST /api/admin/email/tasks/[id]/reply
 * Operator email reply from CRM task widget (manual, not AI draft).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await connection()
  const authResult = await requireEmailAdmin()
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text) {
    return NextResponse.json({ error: 'Reply text required' }, { status: 400 })
  }

  const task = await getEmailTaskService().getTask(id)
  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  const threadId = task.threadId
  const thread = await EmailThreadService.getThread(threadId)

  if (thread?.preferChat) {
    return NextResponse.json({
      success: false,
      skipped: true,
      reason: 'prefer_chat',
      notice:
        'Client is using in-app support chat for this request; email reply was not sent.',
      supportConversationId: thread.supportConversationId ?? null,
    })
  }

  const toEmail =
    (typeof body?.toEmail === 'string' && body.toEmail.trim()) ||
    thread?.fromEmail ||
    ''
  if (!toEmail) {
    return NextResponse.json({ error: 'Recipient email required' }, { status: 400 })
  }

  const subject =
    (typeof body?.subject === 'string' && body.subject.trim()) ||
    thread?.subject ||
    task.title ||
    'Re: your inquiry'

  try {
    const { getChannelById, getPrimaryEmailConfig } = await import(
      '@/features/email-crm/pipeline/imap/config'
    )
    const channel = getChannelById(body?.channelId)
    const smtpConfig = channel?.config.smtp || getPrimaryEmailConfig().smtp

    const { messageId } = await getEmailSender().sendReply({
      to: toEmail,
      subject,
      text,
      threadId,
      smtpConfig,
    })

    await EmailMessageService.upsertOutboundMessage({
      messageId,
      threadId,
      toEmail,
      subject,
      bodyText: text,
    })

    await EmailThreadService.upsertThread(threadId, {
      subject,
      fromEmail: toEmail,
      status: 'waiting',
      messageCount: 1,
      lastMessageAt: new Date().toISOString(),
    })

    logger.info('[CRM Task Reply] Operator email sent', {
      taskId: id,
      threadId,
      messageId,
      adminId: authResult.session.user.id,
    })

    return NextResponse.json({ success: true, messageId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Send failed'
    logger.error('[CRM Task Reply] Send failed', { taskId: id, error: message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
