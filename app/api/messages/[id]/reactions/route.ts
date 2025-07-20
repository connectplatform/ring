import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { MessageService } from '@/services/messaging/message-service'
import { z } from 'zod'

// Schema for reaction request
const reactionSchema = z.object({
  emoji: z.string().emoji().max(2) // Single emoji character
})

// Create MessageService instance
const messageService = new MessageService()

/**
 * POST /api/messages/[id]/reactions
 * Add a reaction to a message
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user?.id || !session?.user?.name) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const messageId = params.id
    const userId = session.user.id
    const userName = session.user.name

    // Parse and validate request body
    const body = await request.json()
    const validatedData = reactionSchema.parse(body)

    // Get the message to verify it exists
    const message = await messageService.getMessage(messageId)
    
    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      )
    }

    // Add reaction to message
    const currentReactions = message.reactions || []
    
    // Check if user already reacted with this emoji
    const existingReactionIndex = currentReactions.findIndex(
      r => r.userId === userId && r.emoji === validatedData.emoji
    )

    if (existingReactionIndex >= 0) {
      return NextResponse.json(
        { error: 'You already reacted with this emoji' },
        { status: 400 }
      )
    }

    // Add new reaction
    const newReaction = {
      userId,
      emoji: validatedData.emoji,
      timestamp: new Date()
    }

    const updatedReactions = [...currentReactions, newReaction]

    // Update message with new reaction
    await messageService.updateMessage(messageId, {
      reactions: updatedReactions as any
    })

    return NextResponse.json({
      success: true,
      data: {
        messageId,
        reaction: newReaction
      }
    })

  } catch (error) {
    console.error('Error adding reaction:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid emoji', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to add reaction' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/messages/[id]/reactions
 * Remove a reaction from a message
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

    // Parse request body
    const body = await request.json()
    const validatedData = reactionSchema.parse(body)

    // Get the message
    const message = await messageService.getMessage(messageId)
    
    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      )
    }

    // Remove reaction from message
    const currentReactions = message.reactions || []
    
    // Filter out user's reaction with this emoji
    const updatedReactions = currentReactions.filter(
      r => !(r.userId === userId && r.emoji === validatedData.emoji)
    )

    if (currentReactions.length === updatedReactions.length) {
      return NextResponse.json(
        { error: 'Reaction not found' },
        { status: 404 }
      )
    }

    // Update message
    await messageService.updateMessage(messageId, {
      reactions: updatedReactions as any
    })

    return NextResponse.json({
      success: true,
      data: {
        messageId,
        emoji: validatedData.emoji,
        removedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error removing reaction:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid emoji', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to remove reaction' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/messages/[id]/reactions
 * Get all reactions for a message
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

    // Group reactions by emoji
    const reactionGroups: Record<string, { emoji: string; count: number; users: string[] }> = {}
    
    for (const reaction of (message.reactions || [])) {
      if (!reactionGroups[reaction.emoji]) {
        reactionGroups[reaction.emoji] = {
          emoji: reaction.emoji,
          count: 0,
          users: []
        }
      }
      
      reactionGroups[reaction.emoji].count++
      reactionGroups[reaction.emoji].users.push(reaction.userId)
    }

    return NextResponse.json({
      success: true,
      data: {
        messageId,
        reactions: Object.values(reactionGroups),
        userReactions: (message.reactions || [])
          .filter(r => r.userId === session.user.id)
          .map(r => r.emoji)
      }
    })

  } catch (error) {
    console.error('Error fetching reactions:', error)
    
    return NextResponse.json(
      { error: 'Failed to fetch reactions' },
      { status: 500 }
    )
  }
} 