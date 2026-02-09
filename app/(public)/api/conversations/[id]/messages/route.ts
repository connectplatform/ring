import { NextRequest, NextResponse, connection} from 'next/server'
import { auth } from '@/auth'
import { MessageService } from '@/features/chat/services/message-service'
import { SendMessageRequest, PaginationOptions } from '@/features/chat/types'

const messageService = new MessageService()

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await connection() // Next.js 16: opt out of prerendering

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

    const { searchParams } = new URL(request.url)
    
    // Parse pagination options for cursor-based pagination (infinite scroll)
    const pagination: PaginationOptions = {}
    const limit = searchParams.get('limit')
    if (limit) {
      pagination.limit = parseInt(limit, 10)
    }
    
    const cursor = searchParams.get('cursor')
    if (cursor) {
      pagination.cursor = cursor
    }
    
    const direction = searchParams.get('direction')
    if (direction && ['before', 'after'].includes(direction)) {
      pagination.direction = direction as 'before' | 'after'
    }

    // Get messages for conversation with pagination
    const messages = await messageService.getMessages(
      conversationId,
      session.user.id,
      pagination
    )

    // Messages are automatically marked as delivered in getMessages
    return NextResponse.json({
      success: true,
      data: messages,
      pagination: {
        hasMore: messages.length === (pagination.limit || 50),
        cursor: messages.length > 0 ? messages[messages.length - 1].id : null
      }
    })

  } catch (error) {
    console.error('Error fetching messages:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
      }
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    const session = await auth()
    if (!session?.user?.id || !session?.user?.name) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const conversationId = params.id
    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      )
    }

    const messageData: Omit<SendMessageRequest, 'conversationId'> = await request.json()

    // Validate required fields
    if (!messageData.content || !messageData.content.trim()) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      )
    }

    // Validate message type
    const validTypes = ['text', 'image', 'file', 'system']
    if (messageData.type && !validTypes.includes(messageData.type)) {
      return NextResponse.json(
        { error: 'Invalid message type' },
        { status: 400 }
      )
    }

    // Prepare send message request
    const sendRequest: SendMessageRequest = {
      conversationId,
      content: messageData.content.trim(),
      type: messageData.type || 'text',
      replyTo: messageData.replyTo,
      attachments: messageData.attachments
    }

    // Send new message to conversation
    const message = await messageService.sendMessage(
      sendRequest,
      session.user.id,
      session.user.name,
      session.user.image || undefined
    )

    // Real-time updates and notifications are handled in the service
    return NextResponse.json({
      success: true,
      data: message
    }, { status: 201 })

  } catch (error) {
    console.error('Error sending message:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
      }
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
} 