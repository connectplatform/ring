import { NextRequest, NextResponse, connection} from 'next/server'
import { auth } from '@/auth'
import { ConversationService } from '@/features/chat/services/conversation-service'
import { z } from 'zod'

// Schema for mark as read request
const markAsReadSchema = z.object({
  messageId: z.string().optional(), // Optional: mark up to specific message
  timestamp: z.string().datetime().optional() // Optional: mark up to specific time
})

// Create ConversationService instance
const conversationService = new ConversationService()

/**
 * POST /api/conversations/[id]/read
 * Mark messages as read in a conversation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const conversationId = params.id
    const userId = session.user.id

    // Parse request body (optional)
    let messageId: string | undefined
    let timestamp: string | undefined

    const contentType = request.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      try {
        const body = await request.json()
        const validatedData = markAsReadSchema.parse(body)
        messageId = validatedData.messageId
        timestamp = validatedData.timestamp
      } catch (error) {
        // Optional body, ignore parse errors
      }
    }

    // Update last read status
    await conversationService.updateLastRead(conversationId, userId)

    // Get updated conversation with unread count
    const conversation = await conversationService.getConversationById(conversationId, userId)
    
    return NextResponse.json({
      success: true,
      data: {
        conversationId,
        userId,
        lastReadAt: new Date().toISOString(),
        unreadCount: conversation?.unreadCount || 0,
        messageId,
        timestamp
      }
    })

  } catch (error) {
    console.error('Error marking messages as read:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to mark messages as read' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/conversations/[id]/read
 * Get read status for a conversation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const conversationId = params.id
    const userId = session.user.id

    // Get conversation with read status
    const conversation = await conversationService.getConversationById(conversationId, userId)
    
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Find user's participant info
    const participant = conversation.participants.find(p => p.userId === userId)

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
    console.error('Error fetching read status:', error)
    
    return NextResponse.json(
      { error: 'Failed to fetch read status' },
      { status: 500 }
    )
  }
} 