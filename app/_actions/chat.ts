'use server'

import { db } from '@/lib/database'
import { auth } from '@/auth'

// Interface to represent the state returned by the sendMessage action.
export interface MessageFormState {
  error?: string         // Error message, if any
  success?: boolean      // Success status
  message?: string       // Success message
}

/**
 * Server action for sending a message in a chat.
 * Validates form input, checks authentication, and writes to the 'chats' collection.
 * 
 * @param prevState Previous form state, useful for optimistic UI updates or validation state (not used here)
 * @param formData The form data coming from the client
 * @returns An object describing the outcome of the operation
 */
export async function sendMessage(
  prevState: MessageFormState | null,
  formData: FormData
): Promise<MessageFormState> {

  // Extract relevant data from formData
  const chatId = formData.get('chatId') as string
  const entityId = formData.get('entityId') as string
  const entityName = formData.get('entityName') as string
  const entityCreatorId = formData.get('entityCreatorId') as string
  const opportunityId = formData.get('opportunityId') as string | null
  const opportunityName = formData.get('opportunityName') as string | null
  const messageContent = formData.get('message') as string

  // Check if the message content is provided and contains non-whitespace characters
  if (!messageContent || !messageContent.trim()) {
    return {
      error: 'Message content is required'
    }
  }

  // Check that required chat and entity information exist
  if (!chatId || !entityId || !entityCreatorId) {
    return {
      error: 'Missing required chat information'
    }
  }

  try {
    // Get the current authenticated user session
    const session = await auth()
    // If not authenticated, return an error
    if (!session?.user?.id) {
      return {
        error: 'Authentication required'
      }
    }

    // TODO: Use Next.js 16 server actions input validation, e.g. with zod or a schema to strongly validate fields

    // TODO: Consider using a transactional write, or returning the created message object for optimistic UI in React 19/Next 16

    // TODO: Use server actions' native parameter parsing if available to avoid manual formData extraction

    // Write the message document to the database 'chats' collection
    await db().createDoc('chats', {
      chatId,
      participants: [entityCreatorId, session.user.id], // List of participants (entity creator and sender)
      senderId: session.user.id,                        // Current user is the sender
      content: messageContent.trim(),                   // Trimmed message content
      timestamp: new Date(),                            // Server-side timestamp
      entityId,
      entityName,
      ...(opportunityId && { opportunityId }),          // Opportunistically add opportunity info if provided
      ...(opportunityName && { opportunityName }),
    })

    // Return success state
    return {
      success: true,
      message: 'Message sent successfully'
    }
  } catch (error) {
    // TODO: Consider error reporting/logging to a monitoring service
    console.error('Error sending message:', error)
    return {
      error: 'Failed to send message. Please try again.'
    }
  }
}