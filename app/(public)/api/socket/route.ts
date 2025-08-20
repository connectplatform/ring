import { NextRequest } from 'next/server'
import { Server as SocketIOServer, Socket } from 'socket.io'
import { createServer } from 'http'
import { verifyJwtToken } from '@/lib/auth/jwt'
import { MessageService } from '@/features/chat/services/message-service'
import { ConversationService } from '@/features/chat/services/conversation-service'
import { TypingService } from '@/features/chat/services/typing-service'

interface SocketAuthData {
  userId: string
  userRole: string
  sessionId: string
  userName?: string
  userAvatar?: string
}

// Extend Socket interface to include authData
interface AuthenticatedSocket extends Socket {
  authData: SocketAuthData
}

class WebSocketService {
  private io: SocketIOServer
  private userSockets: Map<string, Set<string>> = new Map()
  private conversationRooms: Map<string, Set<string>> = new Map()
  private messageService = new MessageService()
  private conversationService = new ConversationService()
  private typingService = new TypingService()

  constructor(io: SocketIOServer) {
    this.io = io
    this.setupEventHandlers()
  }

  private async authenticateSocket(socket: Socket): Promise<SocketAuthData | null> {
    try {
      const token = socket.handshake.auth?.token
      if (!token) return null

      const decoded = await verifyJwtToken(token)
      if (!decoded?.sub) return null

      return {
        userId: decoded.sub,
        userRole: (decoded.role as string) || 'member',
        sessionId: (decoded.jti as string) || 'unknown',
        userName: (decoded.name as string) || 'User',
        userAvatar: (decoded.picture as string) || undefined
      }
    } catch (error) {
      console.error('Socket authentication error:', error)
      return null
    }
  }

  private setupEventHandlers() {
    this.io.use(async (socket, next) => {
      const authData = await this.authenticateSocket(socket)
      if (authData) {
        (socket as AuthenticatedSocket).authData = authData
        next()
      } else {
        next(new Error('Authentication failed'))
      }
    })

    this.io.on('connection', (socket) => {
      const authenticatedSocket = socket as AuthenticatedSocket
      const { userId } = authenticatedSocket.authData
      console.log(`User ${userId} connected via WebSocket`)
      
      // Join user to their personal room
      socket.join(`user:${userId}`)
      this.addUserSocket(userId, socket.id)

      // Handle user coming online
      this.broadcastPresenceUpdate(userId, true)

      // Message events
      socket.on('join_conversation', (conversationId) => {
        this.joinConversation(authenticatedSocket, conversationId)
      })

      socket.on('leave_conversation', (conversationId) => {
        this.leaveConversation(authenticatedSocket, conversationId)
      })

      socket.on('send_message', (data) => {
        this.handleSendMessage(authenticatedSocket, data)
      })

      socket.on('typing_start', (data) => {
        this.handleTypingStart(authenticatedSocket, data)
      })

      socket.on('typing_stop', (data) => {
        this.handleTypingStop(authenticatedSocket, data)
      })

      socket.on('mark_read', (data) => {
        this.handleMarkRead(authenticatedSocket, data)
      })

      // Disconnect handling
      socket.on('disconnect', () => {
        console.log(`User ${userId} disconnected from WebSocket`)
        this.removeUserSocket(userId, socket.id)
        if (!this.isUserOnline(userId)) {
          this.broadcastPresenceUpdate(userId, false)
        }
      })
    })
  }

  private joinConversation(socket: AuthenticatedSocket, conversationId: string) {
    socket.join(`conversation:${conversationId}`)
    
    if (!this.conversationRooms.has(conversationId)) {
      this.conversationRooms.set(conversationId, new Set())
    }
    this.conversationRooms.get(conversationId)!.add(socket.id)
    
    console.log(`User ${socket.authData.userId} joined conversation ${conversationId}`)
  }

  private leaveConversation(socket: AuthenticatedSocket, conversationId: string) {
    socket.leave(`conversation:${conversationId}`)
    
    const room = this.conversationRooms.get(conversationId)
    if (room) {
      room.delete(socket.id)
      if (room.size === 0) {
        this.conversationRooms.delete(conversationId)
      }
    }
    
    console.log(`User ${socket.authData.userId} left conversation ${conversationId}`)
  }

  private async handleSendMessage(socket: AuthenticatedSocket, data: any) {
    try {
      const { userId } = socket.authData
      
      // Validate message data
      if (!data.conversationId || !data.content) {
        socket.emit('error', { message: 'Invalid message data' })
        return
      }

      // Verify user has access to conversation
      const conversation = await this.conversationService.getConversationById(data.conversationId, userId)
      if (!conversation) {
        socket.emit('error', { message: 'Conversation not found or access denied' })
        return
      }

      // Send message via service
      const message = await this.messageService.sendMessage(
        {
          conversationId: data.conversationId,
          content: data.content,
          type: data.type || 'text',
          replyTo: data.replyTo,
          attachments: data.attachments
        },
        userId,
        socket.authData.userName || 'User',
        socket.authData.userAvatar
      )

      // Broadcast to conversation participants
      this.io.to(`conversation:${data.conversationId}`).emit('message_received', message)
      
      // Send push notifications to offline users (handled by MessageService)
      
    } catch (error) {
      console.error('Error sending message:', error)
      socket.emit('error', { message: 'Failed to send message' })
    }
  }

  private async handleTypingStart(socket: AuthenticatedSocket, { conversationId }: { conversationId: string }) {
    const { userId } = socket.authData
    
    try {
      await this.typingService.updateTypingStatus(conversationId, userId, socket.authData.userName || 'User', true)
      
      socket.to(`conversation:${conversationId}`).emit('user_typing', {
        userId,
        conversationId,
        isTyping: true
      })
    } catch (error) {
      console.error('Error handling typing start:', error)
    }
  }

  private async handleTypingStop(socket: AuthenticatedSocket, { conversationId }: { conversationId: string }) {
    const { userId } = socket.authData
    
    try {
      await this.typingService.updateTypingStatus(conversationId, userId, socket.authData.userName || 'User', false)
      
      socket.to(`conversation:${conversationId}`).emit('user_typing', {
        userId,
        conversationId,
        isTyping: false
      })
    } catch (error) {
      console.error('Error handling typing stop:', error)
    }
  }

  private async handleMarkRead(socket: AuthenticatedSocket, { conversationId, messageIds }: { conversationId: string, messageIds: string[] }) {
    const { userId } = socket.authData
    
    try {
      await this.conversationService.updateLastRead(conversationId, userId)
      
      // Notify other participants about read status
      socket.to(`conversation:${conversationId}`).emit('messages_read', {
        userId,
        conversationId,
        messageIds,
        readAt: new Date()
      })
    } catch (error) {
      console.error('Error marking messages as read:', error)
    }
  }

  private broadcastPresenceUpdate(userId: string, isOnline: boolean) {
    this.io.emit('presence_update', {
      userId,
      isOnline,
      lastSeen: new Date()
    })
  }

  private addUserSocket(userId: string, socketId: string) {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set())
    }
    this.userSockets.get(userId)!.add(socketId)
  }

  private removeUserSocket(userId: string, socketId: string) {
    const sockets = this.userSockets.get(userId)
    if (sockets) {
      sockets.delete(socketId)
      if (sockets.size === 0) {
        this.userSockets.delete(userId)
      }
    }
  }

  private isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0
  }
}

// Global WebSocket server instance
let wsService: WebSocketService | null = null

export async function GET(request: NextRequest) {
  if (!wsService) {
    // For Next.js API routes, we need to handle WebSocket differently
    // This endpoint will be used for status checks
    return new Response(JSON.stringify({ 
      status: 'WebSocket server not initialized',
      message: 'Use POST to initialize WebSocket server' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ 
    status: 'WebSocket server running',
    activeConnections: wsService ? Array.from((wsService as any).userSockets.keys()).length : 0
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    if (body.action === 'initialize' && !wsService) {
      // For Vercel/serverless, we need a different approach
      // This is a placeholder - actual WebSocket server needs to run separately
      
      return new Response(JSON.stringify({ 
        status: 'success',
        message: 'WebSocket server initialization requested',
        note: 'For production, use a separate WebSocket server or upgrade to Vercel Pro'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ 
      status: 'error',
      message: 'Invalid action or server already initialized'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ 
      status: 'error',
      message: 'Failed to process request'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
} 