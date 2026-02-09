import { NextRequest, NextResponse, connection} from 'next/server'
import { auth } from '@/auth'
import { TypingService } from '@/features/chat/services/typing-service'
import { z } from 'zod'

// Schema for typing update request
const typingSchema = z.object({
  isTyping: z.boolean()
})

// Create TypingService instance
const typingService = new TypingService()

/**
 * POST /api/conversations/[id]/typing
 * Update typing status for the current user in a conversation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user?.id || !session?.user?.name) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const conversationId = params.id
    const userId = session.user.id
    const userName = session.user.name

    // Parse and validate request body
    const body = await request.json()
    const validatedData = typingSchema.parse(body)

    // Update typing status
    await typingService.updateTypingStatus(
      conversationId, 
      userId, 
      userName, 
      validatedData.isTyping
    )

    return NextResponse.json({
      success: true,
      data: {
        conversationId,
        userId,
        isTyping: validatedData.isTyping,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error updating typing status:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update typing status' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/conversations/[id]/typing
 * Get current typing users in a conversation
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

    // Get typing users
    const typingUsers = await typingService.getTypingUsers(conversationId)

    return NextResponse.json({
      success: true,
      data: {
        conversationId,
        typingUsers: typingUsers.filter(user => user.userId !== session.user.id),
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error fetching typing users:', error)
    
    return NextResponse.json(
      { error: 'Failed to fetch typing users' },
      { status: 500 }
    )
  }
} 