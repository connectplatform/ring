import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { ConversationService } from '@/features/chat/services/conversation-service'
import { z } from 'zod'

// Schema to validate the body for marking messages as read; supports optional specificity for message or timestamp
const markAsReadSchema = z.object({
  messageId: z.string().optional(),       // If present, marks read up to a specific message
  timestamp: z.string().datetime().optional() // If present, marks read up to a specific time
})

// Service responsible for conversation-related operations
const conversationService = new ConversationService()

/**
 * POST /api/conversations/[id]/read
 * Marks all messages (or up to a specific message/timestamp) as read for a conversation by the authenticated user
 */
type RouteContext = { params: Promise<{ id: string }> }

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  await connection() // Ensures function is executed dynamically; disables Next.js prerendering for this route

  try {
    // Authenticate request and extract the user's ID
    const session = await auth()
    if (!session?.user?.id) {
      // Return 401 if user is not authenticated
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: conversationId } = await context.params
    const userId = session.user.id

    // Optionally parse the request body, which may include messageId/timestamp bounds
    let messageId: string | undefined
    let timestamp: string | undefined

    const contentType = request.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      try {
        // Validate request against schema, extracting messageId and timestamp if present
        const body = await request.json()
        const validatedData = markAsReadSchema.parse(body)
        messageId = validatedData.messageId
        timestamp = validatedData.timestamp
      } catch (error) {
        // Ignore any body parse or validation errors, as the body is truly optional
      }
    }

    // Mark as read in this conversation (logic may not support partial read by message/timestamp yet)
    // TODO: Extend updateLastRead to actually support partial "read up to message/timestamp" if backend allows.
    await conversationService.updateLastRead(conversationId, userId)

    // Fetch the latest state of the conversation including unread count
    const conversation = await conversationService.getConversationById(conversationId, userId)

    // Build and send response
    return NextResponse.json({
      success: true,
      data: {
        conversationId,
        userId,
        lastReadAt: new Date().toISOString(), // When this mark-as-read was processed; may not reflect precise backend state
        unreadCount: conversation?.unreadCount || 0,
        messageId,
        timestamp
      }
    })

  } catch (error) {
    // Log and handle both validation and unknown errors
    console.error('Error marking messages as read:', error)
    if (error instanceof z.ZodError) {
      // Return validation errors clearly to clients
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }
    // General error fallback
    return NextResponse.json(
      { error: 'Failed to mark messages as read' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/conversations/[id]/read
 * Returns the user's read status and unread message count for a given conversation
 */
export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  await connection() // Ensures function is executed at request time; disables prerendering for this route

  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: conversationId } = await context.params
    const userId = session.user.id

    // Retrieve conversation and all participant info
    const conversation = await conversationService.getConversationById(conversationId, userId)

    if (!conversation) {
      // No conversation found with that ID (or user doesn't have access)
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Find this user's participant details to extract proper lastReadAt info
    const participant = conversation.participants.find(p => p.userId === userId)

    // TODO: If conversation.participants is large, consider optimizing backend for direct lookup by userId.
    // TODO: Consider returning message IDs of unread messages if needed by the UI.

    // Return user's own read status and unread count for this conversation
    return NextResponse.json({
      success: true,
      data: {
        conversationId,
        userId,
        lastReadAt: participant?.lastReadAt || null,
        unreadCount: conversation.unreadCount || 0
      }
    })

  } catch (error) {
    // Log and return a generic error on failure
    console.error('Error fetching read status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch read status' },
      { status: 500 }
    )
  }
}