import { createServer } from 'http'
import next from 'next'
import { Server } from 'socket.io'
import { verifyJwtToken } from './lib/auth/jwt.js'

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

// WebSocket Service Implementation
class WebSocketService {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    })

    this.userSockets = new Map()
    this.conversationRooms = new Map()
    this.setupEventHandlers()
  }

  async authenticateSocket(socket) {
    try {
      const token = socket.handshake.auth.token ||
                    (socket.handshake.headers.authorization || socket.request.headers.authorization || '').replace('Bearer ', '')
      
      if (!token) {
        console.warn('WebSocket authentication failed: No token provided')
        throw new Error('No authentication token provided')
      }

      // Validate token format
      if (typeof token !== 'string' || token.length < 10) {
        console.warn('WebSocket authentication failed: Invalid token format')
        throw new Error('Invalid token format')
      }

      const session = await verifyJwtToken(token, process.env.AUTH_SECRET)

      if (!session || !session.sub) {
        console.warn('WebSocket authentication failed: Invalid session')
        throw new Error('Invalid authentication token')
      }

      console.log(`WebSocket authentication successful for user: ${(session.email) || session.sub}`)
      return session
    } catch (error) {
      console.error('Socket authentication failed:', error.message)
      throw new Error(`Authentication failed: ${error.message}`)
    }
  }

  setupEventHandlers() {
    this.io.use(async (socket, next) => {
      try {
        const session = await this.authenticateSocket(socket)
        socket.userId = session.sub
        socket.userEmail = session.email || session.sub
        socket.sessionData = session
        next()
      } catch (error) {
        console.error('WebSocket middleware authentication failed:', error.message)
        next(new Error('Authentication failed'))
      }
    })

    this.io.on('connection', (socket) => {
      try {
        console.log(`User connected: ${socket.userEmail} (${socket.userId})`)
        
        // Store user socket mapping
        this.userSockets.set(socket.userId, socket)

        // Join user to their personal room for direct notifications
        socket.join(`user:${socket.userId}`)

        // Handle conversation joining with error handling
        socket.on('join_conversation', (conversationId) => {
          try {
            if (!conversationId || typeof conversationId !== 'string') {
              socket.emit('error', { message: 'Invalid conversation ID' })
              return
            }

            socket.join(`conversation:${conversationId}`)
            
            // Track users in conversation room
            if (!this.conversationRooms.has(conversationId)) {
              this.conversationRooms.set(conversationId, new Set())
            }
            this.conversationRooms.get(conversationId).add(socket.userId)
            
            console.log(`User ${socket.userEmail} joined conversation: ${conversationId}`)
            socket.emit('conversation_joined', { conversationId })
          } catch (error) {
            console.error('Error joining conversation:', error)
            socket.emit('error', { message: 'Failed to join conversation' })
          }
        })

        // Handle conversation leaving with error handling
        socket.on('leave_conversation', (conversationId) => {
          try {
            if (!conversationId || typeof conversationId !== 'string') {
              socket.emit('error', { message: 'Invalid conversation ID' })
              return
            }

            socket.leave(`conversation:${conversationId}`)
            
            if (this.conversationRooms.has(conversationId)) {
              this.conversationRooms.get(conversationId).delete(socket.userId)
              if (this.conversationRooms.get(conversationId).size === 0) {
                this.conversationRooms.delete(conversationId)
              }
            }
            
            console.log(`User ${socket.userEmail} left conversation: ${conversationId}`)
            socket.emit('conversation_left', { conversationId })
          } catch (error) {
            console.error('Error leaving conversation:', error)
            socket.emit('error', { message: 'Failed to leave conversation' })
          }
        })

        // Handle message sending
        socket.on('send_message', async (messageData) => {
          try {
            const { conversationId, content, type = 'text' } = messageData
            
            if (!conversationId || !content) {
              socket.emit('error', { message: 'Missing required message data' })
              return
            }

            // Create message object with server-side data
            const message = {
              id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              conversationId,
              senderId: socket.userId,
              senderName: socket.userEmail,
              content,
              type,
              timestamp: new Date(),
              status: 'sent'
            }

            // Broadcast to all users in the conversation
            this.io.to(`conversation:${conversationId}`).emit('message_received', message)
            
            console.log(`Message sent in conversation ${conversationId} by ${socket.userEmail}`)
            
          } catch (error) {
            console.error('Error handling message:', error)
            socket.emit('error', { message: 'Failed to send message' })
          }
        })

        // Handle typing indicators
        socket.on('typing_start', (conversationId) => {
          socket.to(`conversation:${conversationId}`).emit('user_typing', {
            userId: socket.userId,
            userEmail: socket.userEmail,
            isTyping: true
          })
        })

        socket.on('typing_stop', (conversationId) => {
          socket.to(`conversation:${conversationId}`).emit('user_typing', {
            userId: socket.userId,
            userEmail: socket.userEmail,
            isTyping: false
          })
        })

        // Handle presence updates
        socket.on('update_presence', (status) => {
          socket.broadcast.emit('presence_update', {
            userId: socket.userId,
            userEmail: socket.userEmail,
            isOnline: status === 'online',
            lastSeen: new Date()
          })
        })

        // Handle disconnection
        socket.on('disconnect', (reason) => {
          console.log(`User disconnected: ${socket.userEmail} (${reason})`)
          
          // Remove from user sockets mapping
          this.userSockets.delete(socket.userId)
          
          // Remove from all conversation rooms
          for (const [conversationId, users] of this.conversationRooms.entries()) {
            if (users.has(socket.userId)) {
              users.delete(socket.userId)
              if (users.size === 0) {
                this.conversationRooms.delete(conversationId)
              }
            }
          }

          // Broadcast offline status
          socket.broadcast.emit('presence_update', {
            userId: socket.userId,
            userEmail: socket.userEmail,
            isOnline: false,
            lastSeen: new Date()
          })
        })

        // Send connection confirmation
        socket.emit('connected', { 
          message: 'WebSocket connected successfully',
          userId: socket.userId,
          userEmail: socket.userEmail
        })
      } catch (error) {
        console.error('Error in connection handler:', error)
        socket.emit('error', { message: 'Connection handler error' })
      }
    })
  }

  // Public API methods
  sendToUser(userId, event, data) {
    const socket = this.userSockets.get(userId)
    if (socket) {
      socket.emit(event, data)
      return true
    }
    return false
  }

  sendToConversation(conversationId, event, data) {
    this.io.to(`conversation:${conversationId}`).emit(event, data)
  }

  broadcast(event, data) {
    this.io.emit(event, data)
  }

  getActiveUsers() {
    return Array.from(this.userSockets.keys())
  }

  getConversationUsers(conversationId) {
    return Array.from(this.conversationRooms.get(conversationId) || [])
  }
}

// Start the server
app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res)
  })

  // Initialize WebSocket service
  const wsService = new WebSocketService(server)
  
  // Make wsService available globally for API routes if needed
  global.wsService = wsService

  const port = process.env.PORT || 3000
  
  server.listen(port, (err) => {
    if (err) throw err
    console.log(`🚀 Server ready on http://localhost:${port}`)
    console.log(`📡 WebSocket server ready`)
  })
}).catch((ex) => {
  console.error('Error starting server:', ex)
  process.exit(1)
}) 