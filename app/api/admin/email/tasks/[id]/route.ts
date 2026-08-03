import { NextRequest, NextResponse, connection } from 'next/server'
import { requireEmailAdmin } from '@/features/email-crm/lib/admin-auth'
import { getEmailTaskService } from '@/features/email-crm/pipeline/crm/task-service'
import { getEmailContactService } from '@/features/email-crm/pipeline/crm/email-contact-service'
import { EmailThreadService } from '@/features/email-crm/services/email-thread-service'
import { EmailMessageService } from '@/features/email-crm/services/email-message-service'
import { ConversationService } from '@/features/chat/services/conversation-service'
import { findUserByEmail } from '@/features/auth/services/user-resolve'
import { db } from '@/lib/database'

/**
 * GET /api/admin/email/tasks/[id]
 * Expandable CRM task widget payload: task + contact + thread + messages + Ring user + support chat.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await connection()
  const authResult = await requireEmailAdmin()
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { id } = await params
  const adminId = authResult.session.user.id
  const emailTask = await getEmailTaskService().getTask(id)

  if (!emailTask) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  const threadId = emailTask.threadId
  const [thread, messages] = await Promise.all([
    EmailThreadService.getThread(threadId),
    EmailMessageService.listByThread(threadId).catch(() => []),
  ])

  const contactService = getEmailContactService()
  const contactIdFromThread =
    thread?.contactId ||
    (threadId.startsWith('contact-form:') ? threadId.slice('contact-form:'.length) : null)

  let contact = contactIdFromThread
    ? await contactService.findById(contactIdFromThread)
    : null
  if (!contact && thread?.fromEmail) {
    contact = await contactService.findByEmail(thread.fromEmail)
  }

  let user: {
    id: string
    name: string | null
    email: string | null
    image: string | null
    role: string | null
  } | null = null

  const ringUserId = contact?.ringUserId
  if (ringUserId) {
    const userDoc = await db().readDoc<Record<string, unknown>>('users', ringUserId)
    if (userDoc.success && userDoc.data) {
      const u = userDoc.data
      user = {
        id: String(u.id || ringUserId),
        name: (u.name as string) || null,
        email: (u.email as string) || null,
        image: (u.image as string) || (u.photoURL as string) || null,
        role: (u.role as string) || null,
      }
    }
  } else if (contact?.email || thread?.fromEmail) {
    const byEmail = await findUserByEmail(contact?.email || thread!.fromEmail).catch(() => null)
    if (byEmail) {
      user = {
        id: byEmail.id,
        name: byEmail.name ?? null,
        email: byEmail.email ?? null,
        image: byEmail.image ?? null,
        role: (byEmail.role as string) ?? null,
      }
    }
  }

  let supportConversation: {
    id: string
    type: string
    preferChat?: boolean
    messages: Array<{
      id: string
      content: string
      senderId: string
      senderName: string
      timestamp: string | Date
      type: string
    }>
  } | null = null

  const conversationService = new ConversationService()

  try {
    let conv = await conversationService.findSupportConversation(threadId)

    if (!conv && thread?.supportConversationId) {
      const read = await db().readDoc<{
        id: string
        type: string
        metadata?: { preferChat?: boolean; supportRequestId?: string }
        participants?: Array<{ userId: string }>
      }>('conversations', thread.supportConversationId)
      if (read.success && read.data?.type === 'support') {
        conv = read.data as never
      }
    }

    if (conv) {
      // Ensure admin can open the support room to participate
      try {
        await conversationService.addParticipant(conv.id, adminId, 'admin')
      } catch {
        // already participant — ignore
      }

      const msgResult = await db().queryDocs<{
        id: string
        content: string
        senderId: string
        senderName: string
        timestamp: string | Date
        type: string
      }>({
        collection: 'messages',
        filters: [{ field: 'conversationId', operator: '==', value: conv.id }],
        orderBy: [{ field: 'timestamp', direction: 'asc' }],
        pagination: { limit: 50 },
      })

      supportConversation = {
        id: conv.id,
        type: conv.type,
        preferChat:
          (conv as { metadata?: { preferChat?: boolean } }).metadata?.preferChat === true ||
          thread?.preferChat === true,
        messages: (msgResult.success && msgResult.data ? msgResult.data : []).map((m) => ({
          id: m.id,
          content: m.content,
          senderId: m.senderId,
          senderName: m.senderName,
          timestamp: m.timestamp,
          type: m.type,
        })),
      }
    }
  } catch {
    supportConversation = null
  }

  return NextResponse.json({
    task: emailTask,
    thread,
    messages,
    contact,
    user,
    supportConversation,
    sentiment: thread?.sentiment || contact?.sentimentHistory?.at(-1)?.sentiment || null,
    preferChat: thread?.preferChat === true || supportConversation?.preferChat === true,
  })
}
