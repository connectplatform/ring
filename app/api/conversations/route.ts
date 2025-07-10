import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { ConversationService } from '@/services/messaging/conversation-service'
import { CreateConversationRequest, ConversationFilters, PaginationOptions } from '@/features/chat/types'

const conversationService = new ConversationService()

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    
    // Parse filters from query parameters
    const filters: ConversationFilters = {}
    const type = searchParams.get('type')
    if (type && ['direct', 'entity', 'opportunity'].includes(type)) {
      filters.type = type as 'direct' | 'entity' | 'opportunity'
    }
    
    const isActive = searchParams.get('isActive')
    if (isActive !== null) {
      filters.isActive = isActive === 'true'
    }

    // Parse pagination options
    const pagination: PaginationOptions = {}
    const limit = searchParams.get('limit')
    if (limit) {
      pagination.limit = parseInt(limit, 10)
    }
    
    const cursor = searchParams.get('cursor')
    if (cursor) {
      pagination.cursor = cursor
    }

    // Get user conversations with pagination and filtering
    const conversations = await conversationService.getConversations(
      session.user.id,
      filters,
      pagination
    )

    return NextResponse.json({
      success: true,
      data: conversations,
      pagination: {
        hasMore: conversations.length === (pagination.limit || 20),
        cursor: conversations.length > 0 ? conversations[conversations.length - 1].id : null
      }
    })

  } catch (error) {
    console.error('Error fetching conversations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data: CreateConversationRequest = await request.json()

    // Validate required fields
    if (!data.type || !data.participantIds || !Array.isArray(data.participantIds)) {
      return NextResponse.json(
        { error: 'Invalid request data. type and participantIds are required' },
        { status: 400 }
      )
    }

    // Ensure current user is included in participants
    if (!data.participantIds.includes(session.user.id)) {
      data.participantIds.push(session.user.id)
    }

    // Validate conversation type specific requirements
    if (data.type === 'entity' && !data.metadata?.entityId) {
      return NextResponse.json(
        { error: 'entityId is required for entity conversations' },
        { status: 400 }
      )
    }

    if (data.type === 'opportunity' && !data.metadata?.opportunityId) {
      return NextResponse.json(
        { error: 'opportunityId is required for opportunity conversations' },
        { status: 400 }
      )
    }

    // Create new conversation
    const conversation = await conversationService.createConversation(data)

    return NextResponse.json({
      success: true,
      data: conversation
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating conversation:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create conversation' },
      { status: 500 }
    )
  }
} 