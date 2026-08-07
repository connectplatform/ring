'use server'

import { headers } from 'next/headers'
import { sendToTelegramBot } from '@/lib/telegram'
import { auth } from '@/auth'
import { rateLimit } from '@/lib/rate-limit'
import { getEmailContactService, getEmailTaskService } from '@/features/email-crm/pipeline/crm'
import { EmailThreadService } from '@/features/email-crm/services/email-thread-service'
import { findUserByEmail } from '@/features/auth/services/user-resolve'
import {
  hasRoleAtLeast,
  resolveSessionUserRole,
  UserRolesArray,
} from '@/features/auth/user-role'

export type ContactFormErrorKey =
  | 'signInRequired'
  | 'subscriberRequired'
  | 'cannotMessageSelf'
  | 'messageRequired'
  | 'rateLimited'
  | 'recipientNotFound'
  | 'recipientRequired'
  | 'sendFailed'
  | 'allFieldsRequired'
  | 'invalidEmail'
  | 'notAcceptingMessages'

export interface ContactFormState {
  success?: boolean
  message?: string
  /** Client maps via contact.form.* — prefer over hardcoded English message. */
  successKey?: 'thankYou' | 'messageSent'
  /** Client maps via contact.form.* for DM/CRM errors. */
  errorKey?: ContactFormErrorKey
  error?: string
  taskId?: string
  supportConversationId?: string
  conversationId?: string
}

function appendInquiry(existing: string | null | undefined, message: string): string {
  const stamp = new Date().toISOString()
  const block = `[${stamp}]\n${message}`
  if (!existing?.trim()) return block
  return `${existing.trim()}\n\n---\n${block}`
}

async function submitDirectMessageContact(
  formData: FormData,
  session: NonNullable<Awaited<ReturnType<typeof auth>>>,
): Promise<ContactFormState> {
  const recipientUserId = String(formData.get('recipientUserId') || '').trim()
  const entityName = String(formData.get('entityName') || '').trim()
  const name = String(formData.get('name') || '').trim()
  const email = String(formData.get('email') || '').trim()
  const message = String(formData.get('message') || '').trim()

  if (!recipientUserId) {
    return { errorKey: 'recipientRequired', error: 'Recipient is required' }
  }
  if (!session.user?.id) {
    return { errorKey: 'signInRequired', error: 'Sign in to send a message' }
  }
  if (!hasRoleAtLeast(resolveSessionUserRole(session.user.role), UserRolesArray.subscriber)) {
    return {
      errorKey: 'subscriberRequired',
      error: 'Subscriber access required to contact this user',
    }
  }
  if (recipientUserId === session.user.id) {
    return { errorKey: 'cannotMessageSelf', error: 'You cannot message yourself' }
  }
  if (!message) {
    return { errorKey: 'messageRequired', error: 'Message is required' }
  }

  const resolvedName = session.user.name || name || 'Member'
  const resolvedEmail = session.user.email || email || ''

  const headersList = await headers()
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headersList.get('x-real-ip') ||
    'unknown'
  const limit = rateLimit(`contact-dm:${session.user.id}:${ip}`, 8, 60_000)
  if (!limit.ok) {
    return {
      errorKey: 'rateLimited',
      error: 'Too many requests. Please try again in a minute.',
    }
  }

  try {
    const { db } = await import('@/lib/database')
    const recipient = await db().readDoc('users', recipientUserId)
    if (!recipient.success || !recipient.data) {
      return { errorKey: 'recipientNotFound', error: 'Recipient not found' }
    }

    const { acceptsProfileDms } = await import(
      '@/features/auth/lib/personal-page-sections'
    )
    if (!acceptsProfileDms((recipient.data as { acceptProfileDms?: unknown }).acceptProfileDms)) {
      return {
        errorKey: 'notAcceptingMessages',
        error: 'This member is not accepting profile messages',
      }
    }

    const { isDirectMessagingBlockedBetween } = await import(
      '@/features/auth/services/user-blocklist-lib'
    )
    if (await isDirectMessagingBlockedBetween(session.user.id, recipientUserId)) {
      return {
        errorKey: 'notAcceptingMessages',
        error: 'This member is not accepting profile messages',
      }
    }

    const { ConversationService } = await import(
      '@/features/chat/services/conversation-service'
    )
    const { MessageService } = await import('@/features/chat/services/message-service')

    const conversations = new ConversationService()
    const messages = new MessageService()

    const conversation = await conversations.createConversation({
      type: 'direct',
      participantIds: [session.user.id, recipientUserId],
      creatorUserId: session.user.id,
      metadata: {
        directUserId: recipientUserId,
        ...(entityName ? { directUserName: entityName } : {}),
      },
    })

    const content = [
      entityName ? `Contact via @${entityName.replace(/^@/, '')}` : 'Contact via profile',
      resolvedEmail ? `From: ${resolvedName} <${resolvedEmail}>` : `From: ${resolvedName}`,
      '',
      message,
    ].join('\n')

    await messages.sendMessage(
      {
        conversationId: conversation.id,
        content,
        type: 'text',
        metadata: {
          source: 'profile-contact-form',
          entityName: entityName || undefined,
        },
      },
      session.user.id,
      resolvedName,
      typeof session.user.image === 'string' ? session.user.image : undefined,
    )

    return {
      success: true,
      successKey: 'messageSent',
      conversationId: conversation.id,
    }
  } catch (error) {
    console.error('Profile contact DM failed:', error)
    const detail =
      process.env.NODE_ENV !== 'production' && error instanceof Error
        ? ` (${error.message})`
        : ''
    return {
      errorKey: 'sendFailed',
      error: `Failed to send message. Please try again.${detail}`,
    }
  }
}

export async function submitContactForm(
  prevState: ContactFormState | null,
  formData: FormData,
): Promise<ContactFormState> {
  const honeypot = formData.get('website') as string
  if (honeypot) {
    return { success: true, successKey: 'thankYou' }
  }

  const session = await auth()
  const deliveryMode = String(formData.get('deliveryMode') || 'crm').trim()

  // Private /username profile: reuse same form UI → owner DM inbox
  if (deliveryMode === 'direct_message') {
    if (!session?.user?.id) {
      return { errorKey: 'signInRequired', error: 'Sign in to send a message' }
    }
    return submitDirectMessageContact(formData, session)
  }

  const headersList = await headers()
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headersList.get('x-real-ip') ||
    'unknown'
  const limit = rateLimit(`contact:${ip}`, 5, 60_000)
  if (!limit.ok) {
    return {
      errorKey: 'rateLimited',
      error: 'Too many requests. Please try again in a minute.',
    }
  }

  const entityId = formData.get('entityId') as string
  const entityName = formData.get('entityName') as string
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const message = formData.get('message') as string

  if (!name || !email || !message) {
    return { errorKey: 'allFieldsRequired', error: 'All fields are required' }
  }

  if (!/\S+@\S+\.\S+/.test(email)) {
    return { errorKey: 'invalidEmail', error: 'Please enter a valid email address' }
  }

  const resolvedName = session?.user?.name || name
  const resolvedEmail = session?.user?.email || email

  let ringUserId = session?.user?.id as string | undefined
  if (!ringUserId) {
    try {
      const known = await findUserByEmail(resolvedEmail)
      if (known?.id) ringUserId = known.id
    } catch {
      // non-fatal — anonymous lead still creates CRM task
    }
  }

  let taskId: string | undefined
  let supportConversationId: string | undefined

  // CRM is SSOT — Telegram notify must not block lead capture
  try {
    const contactService = getEmailContactService()
    const contact = await contactService.getOrCreateContact(resolvedEmail, {
      name: resolvedName,
      type: ringUserId ? 'customer' : 'lead',
      tags: ['contact-form'],
      metadata: {
        message,
        entityId,
        entityName,
        source: 'contact-form',
      },
      ringUserId,
    })

    if (ringUserId && !contact.ringUserId) {
      await contactService.updateContact(contact.id, { ringUserId, type: 'customer' })
    }

    const threadId = `contact-form:${contact.id}`
    const taskService = getEmailTaskService()
    const subject = `Contact form: ${resolvedName}`
    const priorThread = await EmailThreadService.getThread(threadId)

    const existingOpen = (await taskService.getThreadTasks(threadId)).find((t) =>
      ['open', 'in_progress', 'overdue'].includes(t.status),
    )

    if (existingOpen) {
      const updated = await taskService.updateTask(existingOpen.id, {
        description: appendInquiry(existingOpen.description, message),
      })
      taskId = updated.id
    } else {
      const task = await taskService.createTask({
        threadId,
        title: subject,
        description: message,
        taskType: 'follow_up',
        dueDays: 1,
        priority: 'normal',
        autoGenerated: true,
        triggerReason: 'contact-form',
      })
      taskId = task.id
    }

    await EmailThreadService.upsertThread(threadId, {
      subject,
      fromEmail: resolvedEmail,
      fromName: resolvedName,
      // Preserve status on resubmit; reopen only if previously resolved
      ...(priorThread
        ? priorThread.status === 'resolved'
          ? { status: 'ongoing' as const }
          : {}
        : { status: 'new' as const }),
      priority: priorThread?.priority || 'normal',
      intent: 'contact_form',
      contactId: contact.id,
      contact: {
        type: contact.type,
        company: contact.company,
        interactions: contact.totalInteractions,
      },
      sourceChannel: 'contact-form',
      messageCount: 1,
      lastMessageAt: new Date().toISOString(),
    })

    // Persist inquiry as email_messages so CRM task expand shows a real thread row
    try {
      const { EmailMessageService } = await import(
        '@/features/email-crm/services/email-message-service'
      )
      await EmailMessageService.upsertContactFormInquiry({
        messageId: `contact-form-msg:${taskId}:${Date.now()}`,
        threadId,
        fromEmail: resolvedEmail,
        fromName: resolvedName,
        subject,
        bodyText: message,
      })
    } catch (msgErr) {
      console.warn('Contact form CRM message persist skipped:', msgErr)
    }

    if (ringUserId) {
      const { ensureSupportChatForRequest } = await import(
        '@/features/email-crm/services/support-chat-service'
      )
      const conversation = await ensureSupportChatForRequest({
        supportRequestId: threadId,
        userId: ringUserId,
        userName: resolvedName,
        message,
        emailContactId: contact.id,
        contactEmail: resolvedEmail,
        subject,
        taskId,
      })
      supportConversationId = conversation?.id
    }
  } catch (crmError) {
    console.error('Error writing contact form to CRM:', crmError)
    const detail =
      process.env.NODE_ENV !== 'production' && crmError instanceof Error
        ? ` (${crmError.message})`
        : ''
    return {
      errorKey: 'sendFailed',
      error: `Failed to send message. Please try again.${detail}`,
    }
  }

  try {
    await sendToTelegramBot({
      entityId,
      entityName,
      name: resolvedName,
      email: resolvedEmail,
      message,
      userId: ringUserId || session?.user?.id,
    })
  } catch (error) {
    console.warn('CRM lead saved; Telegram notify skipped:', error)
  }

  return {
    success: true,
    successKey: 'thankYou',
    taskId,
    supportConversationId,
  }
}
