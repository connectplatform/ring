'use server'

import { headers } from 'next/headers'
import { auth } from '@/auth'
import { rateLimit } from '@/lib/rate-limit'
import { submitPlatformContactInquiry } from '@/features/forms/services/platform-contact-submit'
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

  return submitPlatformContactInquiry({
    name: session?.user?.name || name,
    email: session?.user?.email || email,
    message,
    entityId: entityId || 'contact_page',
    entityName: entityName || 'Contact Page',
    userId: typeof session?.user?.id === 'string' ? session.user.id : undefined,
  })
}
