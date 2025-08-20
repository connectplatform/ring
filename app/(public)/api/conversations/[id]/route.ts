import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { ConversationService } from '@/features/chat/services/conversation-service'

const conversationService = new ConversationService()

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const conversationId = params.id
    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      )
    }

    // Get conversation details with full participant info
    const conversation = await conversationService.getConversationById(
      conversationId,
      session.user.id
    )

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: conversation
    })

  } catch (error) {
    console.error('Error fetching conversation:', error)
    
    if (error instanceof Error && error.message.includes('Access denied')) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch conversation' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const conversationId = params.id
    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      )
    }

    const { action, ...data } = await request.json()

    switch (action) {
      case 'mark_read':
        // Mark messages as read and update participant lastReadAt timestamp
        await conversationService.updateLastRead(conversationId, session.user.id)
        return NextResponse.json({
          success: true,
          message: 'Conversation marked as read'
        })

      case 'add_participant':
        const { userId, role = 'member' } = data
        if (!userId) {
          return NextResponse.json(
            { error: 'userId is required to add participant' },
            { status: 400 }
          )
        }
        
        await conversationService.addParticipant(conversationId, userId, role)
        return NextResponse.json({
          success: true,
          message: 'Participant added successfully'
        })

      case 'remove_participant':
        const { userId: removeUserId } = data
        if (!removeUserId) {
          return NextResponse.json(
            { error: 'userId is required to remove participant' },
            { status: 400 }
          )
        }
        
        await conversationService.removeParticipant(conversationId, removeUserId)
        return NextResponse.json({
          success: true,
          message: 'Participant removed successfully'
        })

      case 'archive':
        // Archive conversation (set isActive to false)
        // This would require adding an archive method to ConversationService
        return NextResponse.json(
          { error: 'Archive functionality not yet implemented' },
          { status: 501 }
        )

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: mark_read, add_participant, remove_participant, archive' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Error updating conversation:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
      }
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
      if (error.message.includes('already a participant')) {
        return NextResponse.json({ error: error.message }, { status: 409 })
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to update conversation' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const conversationId = params.id
    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      )
    }

    // For now, we'll implement this as removing the current user from the conversation
    // Full deletion would require additional logic and permissions
    await conversationService.removeParticipant(conversationId, session.user.id)

    return NextResponse.json({
      success: true,
      message: 'Left conversation successfully'
    })

  } catch (error) {
    console.error('Error leaving conversation:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
      }
      if (error.message.includes('not a participant')) {
        return NextResponse.json({ error: 'You are not a participant in this conversation' }, { status: 409 })
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to leave conversation' },
      { status: 500 }
    )
  }
} 