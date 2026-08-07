import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { ConversationService } from '@/features/chat/services/conversation-service'

const conversationService = new ConversationService()

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET handler to retrieve a conversation by ID for the authenticated user.
 * Checks for authorization, required parameters, and fetches the conversation including participant details.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: conversationId } = await context.params
    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 },
      )
    }

    const conversation = await conversationService.getConversationById(
      conversationId,
      session.user.id,
    )

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 },
      )
    }

    return NextResponse.json({
      success: true,
      data: conversation,
    })
  } catch (error) {
    console.error('Error fetching conversation:', error)

    if (error instanceof Error && error.message.includes('Access denied')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    return NextResponse.json(
      { error: 'Failed to fetch conversation' },
      { status: 500 },
    )
  }
}

/**
 * PUT handler to update a conversation (mark as read, add or remove participant, or archive).
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: conversationId } = await context.params
    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 },
      )
    }

    const { action, ...data } = await request.json()

    switch (action) {
      case 'mark_read': {
        await conversationService.updateLastRead(conversationId, session.user.id)
        return NextResponse.json({
          success: true,
          message: 'Conversation marked as read',
        })
      }

      case 'mark_unread': {
        await conversationService.markUnread(conversationId, session.user.id)
        return NextResponse.json({
          success: true,
          message: 'Conversation marked as unread',
        })
      }

      case 'archive': {
        const archived = data.archived !== false
        const conversation = await conversationService.setArchived(
          conversationId,
          session.user.id,
          archived,
        )
        return NextResponse.json({
          success: true,
          message: archived ? 'Conversation archived' : 'Conversation unarchived',
          data: conversation,
        })
      }

      case 'toggle_notifications': {
        let nextMuted = data.muted
        if (typeof nextMuted !== 'boolean') {
          const current = await conversationService.getConversationById(
            conversationId,
            session.user.id,
          )
          nextMuted = !current?.metadata?.mutedBy?.includes(session.user.id)
        }
        const conversation = await conversationService.setMuted(
          conversationId,
          session.user.id,
          Boolean(nextMuted),
        )
        return NextResponse.json({
          success: true,
          message: nextMuted ? 'Notifications muted' : 'Notifications enabled',
          data: conversation,
        })
      }

      case 'add_participant': {
        const { userId, role = 'member' } = data
        if (!userId) {
          return NextResponse.json(
            { error: 'userId is required to add participant' },
            { status: 400 },
          )
        }

        await conversationService.addParticipant(
          conversationId,
          userId,
          role,
          session.user.id,
        )
        return NextResponse.json({
          success: true,
          message: 'Participant added successfully',
        })
      }

      case 'remove_participant': {
        const { userId: removeUserId } = data
        if (!removeUserId) {
          return NextResponse.json(
            { error: 'userId is required to remove participant' },
            { status: 400 },
          )
        }

        await conversationService.removeParticipant(
          conversationId,
          removeUserId,
          session.user.id,
        )
        return NextResponse.json({
          success: true,
          message: 'Participant removed successfully',
        })
      }

      case 'update_metadata': {
        const current = await conversationService.getConversationById(
          conversationId,
          session.user.id,
        )
        if (!current) {
          return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
        }
        const actor = current.participants.find((p) => p.userId === session.user.id)
        if (actor?.role !== 'admin') {
          return NextResponse.json(
            { error: 'Access denied: Only admins can update conversation metadata' },
            { status: 403 },
          )
        }
        if (current.type !== 'group') {
          return NextResponse.json(
            { error: 'update_metadata currently supports group conversations only' },
            { status: 400 },
          )
        }
        const groupName =
          typeof data.groupName === 'string' ? data.groupName.trim() : undefined
        if (!groupName) {
          return NextResponse.json(
            { error: 'groupName is required' },
            { status: 400 },
          )
        }
        await conversationService.updateConversation(conversationId, session.user.id, {
          metadata: { ...current.metadata, groupName },
        })
        const updated = await conversationService.getConversationById(
          conversationId,
          session.user.id,
        )
        return NextResponse.json({
          success: true,
          message: 'Conversation metadata updated',
          data: updated,
        })
      }

      default:
        return NextResponse.json(
          {
            error:
              'Invalid action. Supported actions: mark_read, mark_unread, archive, toggle_notifications, add_participant, remove_participant, update_metadata',
          },
          { status: 400 },
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
      { status: 500 },
    )
  }
}

/**
 * DELETE handler for a conversation.
 * By default, removes the current user from the conversation ("leave conversation").
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: conversationId } = await context.params
    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 },
      )
    }

    await conversationService.removeParticipant(conversationId, session.user.id, session.user.id)

    return NextResponse.json({
      success: true,
      message: 'Left conversation successfully',
    })
  } catch (error) {
    console.error('Error leaving conversation:', error)

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
      }
      if (error.message.includes('not a participant')) {
        return NextResponse.json(
          { error: 'You are not a participant in this conversation' },
          { status: 409 },
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to leave conversation' },
      { status: 500 },
    )
  }
}
