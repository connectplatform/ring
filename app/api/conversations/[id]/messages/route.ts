import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { MessageService } from '@/features/chat/services/message-service'
import { SendMessageRequest, PaginationOptions } from '@/features/chat/types'

// Instantiate the message service used for fetching/sending messages
const messageService = new MessageService()

/**
 * GET handler for fetching messages in a conversation, with cursor-based pagination.
 * Enforces user authentication, validates query params and conversation existence.
 */
type RouteContext = { params: Promise<{ id: string }> }

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  // Ensures this route does not get statically prerendered by Next.js (Next16 feature)
  await connection()

  try {
    // Retrieve the auth session of the user
    const session = await auth()
    if (!session?.user?.id) {
      // User must be authenticated
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: conversationId } = await context.params
    if (!conversationId) {
      // Defensive: should always be set, but check in case of malformed request
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      )
    }

    // Parse query string for pagination: limit, cursor, and direction
    const { searchParams } = new URL(request.url)
    const pagination: PaginationOptions = {}

    const limit = searchParams.get('limit')
    if (limit) {
      pagination.limit = parseInt(limit, 10)
      // TODO: Use zod or another schema validation library for type safety & param validation
    }
    const cursor = searchParams.get('cursor')
    if (cursor) {
      pagination.cursor = cursor
    }
    const direction = searchParams.get('direction')
    if (direction && ['before', 'after'].includes(direction)) {
      pagination.direction = direction as 'before' | 'after'
    }
    // TODO: Next.js 16 supports new request.url/params APIs, consider `request.nextUrl` for cleaner param parsing

    // Fetch paginated messages for the authenticated user and conversation
    const messages = await messageService.getMessages(
      conversationId,
      session.user.id,
      pagination
    )

    // Compose paginated response: hasMore if we hit the limit, and next cursor if any
    return NextResponse.json({
      success: true,
      data: messages,
      pagination: {
        hasMore: messages.length === (pagination.limit || 50),
        cursor: messages.length > 0 ? messages[messages.length - 1].id : null
      }
    })

  } catch (error) {
    // Log the error for debugging purposes
    console.error('Error fetching messages:', error)

    // Handle specific known error types based on error messages for better UX
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
      }
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }
    // Default error response
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}

/**
 * POST handler for sending a message in a conversation.
 * Requires authentication, validates input, and sends a new message.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  // Ensures this route does not get statically prerendered by Next.js (Next16 feature)
  await connection()

  try {
    // Enforce user authentication
    const session = await auth()
    // User must have id and name to send a message
    if (!session?.user?.id || !session?.user?.name) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: conversationId } = await context.params
    if (!conversationId) {
      // Defensive: API should always provide conversationId param
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      )
    }

    // Parse incoming message POST body (without conversationId)
    const messageData: Omit<SendMessageRequest, 'conversationId'> = await request.json()

    // Validate that message content is provided and not just whitespace
    if (!messageData.content || !messageData.content.trim()) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      )
    }

    // Validate type if provided (must be one of known types)
    const validTypes = ['text', 'image', 'file', 'system']
    if (messageData.type && !validTypes.includes(messageData.type)) {
      return NextResponse.json(
        { error: 'Invalid message type' },
        { status: 400 }
      )
    }

    // Compose full send request object, defaulting to 'text' if type is not set
    const sendRequest: SendMessageRequest = {
      conversationId,
      content: messageData.content.trim(),
      type: messageData.type || 'text',
      replyTo: messageData.replyTo,
      attachments: messageData.attachments
    }

    // Call message service to send (and persist) the message
    // Real-time and notification handling is managed by the service itself
    const message = await messageService.sendMessage(
      sendRequest,
      session.user.id,
      session.user.name,
      session.user.image || undefined
    )

    // Respond with created message, status 201 (created)
    return NextResponse.json({
      success: true,
      data: message
    }, { status: 201 })

  } catch (error) {
    // Log for debugging
    console.error('Error sending message:', error)

    // Handle specific known error types with user-friendly responses
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
      }
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }
    // Default error response
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}