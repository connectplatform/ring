import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { ConversationService } from '@/features/chat/services/conversation-service'

const conversationService = new ConversationService()

/**
 * GET handler to retrieve a conversation by ID for the authenticated user.
 * Checks for authorization, required parameters, and fetches the conversation including participant details.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await connection() // Next.js 16: opt out of prerendering
  // TODO: Explore moving connection management to a middleware for even stricter separation of concerns

  try {
    const session = await auth()
    // If the user is not authenticated, return 401
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const conversationId = params.id
    // Validate conversation ID param
    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      )
    }

    // Fetch conversation including participants for the authenticated user
    const conversation = await conversationService.getConversationById(
      conversationId,
      session.user.id
    )

    // Handle not found
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Success response
    return NextResponse.json({
      success: true,
      data: conversation
    })

  } catch (error) {
    // Log error to server console for debugging
    console.error('Error fetching conversation:', error)
    
    // Handle forbidden access due to explicit "Access denied" errors
    if (error instanceof Error && error.message.includes('Access denied')) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }
    
    // Handle unexpected server errors
    return NextResponse.json(
      { error: 'Failed to fetch conversation' },
      { status: 500 }
    )
  }
}

/**
 * PUT handler to update a conversation (mark as read, add or remove participant, or archive).
 * Checks for authorization, required parameters, and delegates actions to ConversationService.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    const session = await auth()
    // Require authentication
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const conversationId = params.id
    // Validate conversation ID param
    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      )
    }

    // Expect JSON body with action and additional data fields
    const { action, ...data } = await request.json()

    switch (action) {
      case 'mark_read': {
        // Mark messages as read for this user in this conversation
        await conversationService.updateLastRead(conversationId, session.user.id)
        return NextResponse.json({
          success: true,
          message: 'Conversation marked as read'
        })
      }

      case 'add_participant': {
        // Destructure userId and role from data; default role to 'member'
        const { userId, role = 'member' } = data
        if (!userId) {
          // Missing user ID for action
          return NextResponse.json(
            { error: 'userId is required to add participant' },
            { status: 400 }
          )
        }

        // Add participant to the conversation
        await conversationService.addParticipant(conversationId, userId, role)
        return NextResponse.json({
          success: true,
          message: 'Participant added successfully'
        })
      }

      case 'remove_participant': {
        // Only userId is needed for removal (aliased as removeUserId)
        const { userId: removeUserId } = data
        if (!removeUserId) {
          return NextResponse.json(
            { error: 'userId is required to remove participant' },
            { status: 400 }
          )
        }

        // Remove participant from the conversation
        await conversationService.removeParticipant(conversationId, removeUserId)
        return NextResponse.json({
          success: true,
          message: 'Participant removed successfully'
        })
      }

      case 'archive':
        // Archive functionality not implemented
        // TODO: Implement archive functionality in ConversationService and enable this endpoint
        return NextResponse.json(
          { error: 'Archive functionality not yet implemented' },
          { status: 501 }
        )

      default:
        // Unrecognized action
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: mark_read, add_participant, remove_participant, archive' },
          { status: 400 }
        )
    }

  } catch (error) {
    // Log update error
    console.error('Error updating conversation:', error)
    
    if (error instanceof Error) {
      // Specific error responses by message
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
      }
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
      if (error.message.includes('already a participant')) {
        // Often happens when adding someone twice
        return NextResponse.json({ error: error.message }, { status: 409 })
      }
    }
    
    // Unhandled server error
    return NextResponse.json(
      { error: 'Failed to update conversation' },
      { status: 500 }
    )
  }
}

/**
 * DELETE handler for a conversation.
 * By default, removes the current user from the conversation ("leave conversation").
 * TODO: Consider implementing differentiated delete/leave operations and stricter permission checks.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    const session = await auth()
    if (!session?.user?.id) {
      // Unauthorized users may not leave conversations
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const conversationId = params.id
    if (!conversationId) {
      // Param required for operation
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      )
    }

    // By default, "delete" means leave the conversation for the current user
    // TODO: Implement actual delete (with admin rights) for hard delete scenarios
    await conversationService.removeParticipant(conversationId, session.user.id)

    return NextResponse.json({
      success: true,
      message: 'Left conversation successfully'
    })

  } catch (error) {
    // Log error to server console
    console.error('Error leaving conversation:', error)
    
    if (error instanceof Error) {
      // Not found or not a participant error messages
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
      }
      if (error.message.includes('not a participant')) {
        return NextResponse.json({ error: 'You are not a participant in this conversation' }, { status: 409 })
      }
    }
    
    // Unknown/unexpected failure
    return NextResponse.json(
      { error: 'Failed to leave conversation' },
      { status: 500 }
    )
  }
}