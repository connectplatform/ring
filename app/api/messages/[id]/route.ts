import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { MessageService } from '@/services/messaging/message-service'
import { z } from 'zod'
import { Timestamp } from 'firebase-admin/firestore'

// Schema for message update
const updateMessageSchema = z.object({
  content: z.string().min(1).max(5000)
})

// Create MessageService instance
const messageService = new MessageService()

/**
 * PUT /api/messages/[id]
 * Edit a message
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const messageId = params.id
    const userId = session.user.id

    // Parse and validate request body
    const body = await request.json()
    const validatedData = updateMessageSchema.parse(body)

    // Get the original message to verify ownership
    const originalMessage = await messageService.getMessage(messageId)
    
    if (!originalMessage) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      )
    }

    // Check if user owns the message
    if (originalMessage.senderId !== userId) {
      return NextResponse.json(
        { error: 'You can only edit your own messages' },
        { status: 403 }
      )
    }

    // Check if message is too old to edit (e.g., 15 minutes)
    const messageAge = Date.now() - originalMessage.timestamp.toMillis()
    const MAX_EDIT_TIME = 15 * 60 * 1000 // 15 minutes
    
    if (messageAge > MAX_EDIT_TIME) {
      return NextResponse.json(
        { error: 'Message is too old to edit' },
        { status: 400 }
      )
    }

    // Update the message
    const updatedMessage = await messageService.updateMessage(messageId, {
      content: validatedData.content,
      editedAt: Timestamp.now()
    })

    return NextResponse.json({
      success: true,
      data: updatedMessage
    })

  } catch (error) {
    console.error('Error updating message:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update message' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/messages/[id]
 * Delete a message (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const messageId = params.id
    const userId = session.user.id

    // Get the original message to verify ownership
    const originalMessage = await messageService.getMessage(messageId)
    
    if (!originalMessage) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      )
    }

    // Check if user owns the message
    if (originalMessage.senderId !== userId) {
      return NextResponse.json(
        { error: 'You can only delete your own messages' },
        { status: 403 }
      )
    }

    // Soft delete the message
    await messageService.deleteMessage(messageId)

    return NextResponse.json({
      success: true,
      data: {
        messageId,
        deletedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error deleting message:', error)
    
    return NextResponse.json(
      { error: 'Failed to delete message' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/messages/[id]
 * Get a single message
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const messageId = params.id

    // Get the message
    const message = await messageService.getMessage(messageId)
    
    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      )
    }

    // TODO: Verify user has access to this message's conversation

    return NextResponse.json({
      success: true,
      data: message
    })

  } catch (error) {
    console.error('Error fetching message:', error)
    
    return NextResponse.json(
      { error: 'Failed to fetch message' },
      { status: 500 }
    )
  }
} 