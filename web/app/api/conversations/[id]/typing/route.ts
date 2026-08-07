import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { TypingService } from '@/features/chat/services/typing-service'
import { z } from 'zod'

// Schema for typing update request validation
const typingSchema = z.object({
  isTyping: z.boolean(),
})

// Create the TypingService instance
const typingService = new TypingService()

/**
 * POST /api/conversations/[id]/typing
 * Updates typing status for the current user in a conversation.
 */
type RouteContext = { params: Promise<{ id: string }> }

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  // Ensures Next.js opt-out of prerendering for dynamic request
  await connection()

  try {
    // Authenticate the user session, ensure the presence of user id and name
    const session = await auth()
    if (!session?.user?.id || !session?.user?.name) {
      // User not authenticated or missing session details
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: conversationId } = await context.params
    const userId = session.user.id
    const userName = session.user.name

    // Parse and validate the incoming JSON body against typingSchema
    const body = await request.json()
    const validatedData = typingSchema.parse(body)

    // Register/update the user's typing status within this conversation
    await typingService.updateTypingStatus(
      conversationId,
      userId,
      userName,
      validatedData.isTyping
    )

    // Respond with success, echoing some useful metadata (including timestamp)
    return NextResponse.json({
      success: true,
      data: {
        conversationId,
        userId,
        isTyping: validatedData.isTyping,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    // Log any server-side errors
    console.error('Error updating typing status:', error)

    // If error is due to validation, respond with 400 Bad Request and details
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    // Otherwise, respond with a general server error
    return NextResponse.json(
      { error: 'Failed to update typing status' },
      { status: 500 }
    )
  }
  // TODO: Consider returning early if params.id is missing or invalid to further guard from invalid calls.
  // TODO: If POST typing endpoint is called repeatedly, consider debouncing or rate-limiting (native Next.js middleware could help).
  // TODO: Explore Edge runtime support, if performance or latency is a concern.
}

/**
 * GET /api/conversations/[id]/typing
 * Returns a list of currently typing users in a conversation, excluding current user.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  // Next.js 16: opt out of prerendering (enables dynamic fetching per request)
  await connection()

  try {
    // Authenticate the session and ensure a valid user id is present
    const session = await auth()
    if (!session?.user?.id) {
      // User is not authenticated
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: conversationId } = await context.params

    // Fetch all users currently typing in this conversation
    const typingUsers = await typingService.getTypingUsers(conversationId)

    // Exclude the currently authenticated user from the response
    // This prevents the frontend from showing "You are typing" redundantly
    return NextResponse.json({
      success: true,
      data: {
        conversationId,
        typingUsers: typingUsers.filter(user => user.userId !== session.user.id),
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    // Log and return server error
    console.error('Error fetching typing users:', error)

    return NextResponse.json(
      { error: 'Failed to fetch typing users' },
      { status: 500 }
    )
  }
  // TODO: Add query validation for conversationId parameter (consider zod or Next.js Route Segment config).
  // TODO: Consider caching typing state or using server-sent events/React Server Actions for optimal realtime support (see React 19 RFC).
}