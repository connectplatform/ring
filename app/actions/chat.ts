import { addDoc, collection, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase-client'

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
    // Create message document
    await addDoc(collection(db, 'chats'), {
      chatId,
      participants: [entityCreatorId], // Will be expanded based on user
      senderId: 'current-user-id', // This should come from session
      content: messageContent.trim(),
      timestamp: Timestamp.now(),
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