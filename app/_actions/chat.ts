'use server'

import { getAdminDb } from '@/lib/firebase-admin.server'
import { FieldValue } from 'firebase-admin/firestore'
import { getServerAuthSession } from '@/auth'

export interface MessageFormState {
  error?: string
  success?: boolean
  message?: string
}

export async function sendMessage(
  prevState: MessageFormState | null,
  formData: FormData
): Promise<MessageFormState> {
  const chatId = formData.get('chatId') as string
  const entityId = formData.get('entityId') as string
  const entityName = formData.get('entityName') as string
  const entityCreatorId = formData.get('entityCreatorId') as string
  const opportunityId = formData.get('opportunityId') as string | null
  const opportunityName = formData.get('opportunityName') as string | null
  const messageContent = formData.get('message') as string

  // Basic validation
  if (!messageContent || !messageContent.trim()) {
    return {
      error: 'Message content is required'
    }
  }

  if (!chatId || !entityId || !entityCreatorId) {
    return {
      error: 'Missing required chat information'
    }
  }

  try {
    // Get current user session
    const session = await getServerAuthSession()
    if (!session?.user?.id) {
      return {
        error: 'Authentication required'
      }
    }

    // Get admin database instance
    const db = getAdminDb()

    // Create message document
    await db.collection('chats').add({
      chatId,
      participants: [entityCreatorId, session.user.id],
      senderId: session.user.id,
      content: messageContent.trim(),
      timestamp: FieldValue.serverTimestamp(),
      entityId,
      entityName,
      ...(opportunityId && { opportunityId }),
      ...(opportunityName && { opportunityName })
    })

    return {
      success: true,
      message: 'Message sent successfully'
    }
  } catch (error) {
    console.error('Error sending message:', error)
    return {
      error: 'Failed to send message. Please try again.'
    }
  }
} 