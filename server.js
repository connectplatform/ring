const { createServer } = require('http')
const next = require('next')
const { Server } = require('socket.io')
const { auth } = require('./auth')
const { getToken } = require('next-auth/jwt')

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
      const token = socket.handshake.auth.token
      if (!token) return null

      // Verify JWT token (adjust based on your auth setup)
      const decoded = await getToken({
        req: { headers: { authorization: `Bearer ${token}` } },
        secret: process.env.NEXTAUTH_SECRET
      })

      if (!decoded || !decoded.sub) return null

      return {
        userId: decoded.sub,
        userRole: decoded.role || 'user',
        userName: decoded.name || 'User',
        userAvatar: decoded.picture,
        sessionId: decoded.jti
      }
    } catch (error) {
      console.error('Socket authentication error:', error)
      return null
    }
  }

  setupEventHandlers() {
    this.io.use(async (socket, next) => {
      const authData = await this.authenticateSocket(socket)
      if (authData) {
        socket.authData = authData
        next()
      } else {
        next(new Error('Authentication failed'))
      }
    })

    this.io.on('connection', (socket) => {
      const { userId, userName } = socket.authData
      console.log(`User ${userName} (${userId}) connected via WebSocket`)

      // Join user to their personal room
      socket.join(`user:${userId}`)
      this.addUserSocket(userId, socket.id)

      // Broadcast user presence
      this.broadcastPresenceUpdate(userId, true)

      // Handle conversation events
      socket.on('join_conversation', (conversationId) => {
        this.joinConversation(socket, conversationId)
      })

      socket.on('leave_conversation', (conversationId) => {
        this.leaveConversation(socket, conversationId)
      })

      socket.on('send_message', (data) => {
        this.handleSendMessage(socket, data)
      })

      socket.on('typing_start', (data) => {
        this.handleTypingStart(socket, data)
      })

      socket.on('typing_stop', (data) => {
        this.handleTypingStop(socket, data)
      })

      socket.on('mark_read', (data) => {
        this.handleMarkRead(socket, data)
      })

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`User ${userName} (${userId}) disconnected`)
        this.removeUserSocket(userId, socket.id)
        if (!this.isUserOnline(userId)) {
          this.broadcastPresenceUpdate(userId, false)
        }
      })
    })
  }

  joinConversation(socket, conversationId) {
    socket.join(`conversation:${conversationId}`)
    if (!this.conversationRooms.has(conversationId)) {
      this.conversationRooms.set(conversationId, new Set())
    }
    this.conversationRooms.get(conversationId).add(socket.id)
  }

  leaveConversation(socket, conversationId) {
    socket.leave(`conversation:${conversationId}`)
    const room = this.conversationRooms.get(conversationId)
    if (room) {
      room.delete(socket.id)
      if (room.size === 0) {
        this.conversationRooms.delete(conversationId)
      }
    }
  }

  async handleSendMessage(socket, data) {
    try {
      const { userId, userName, userAvatar } = socket.authData
      
      // Basic validation
      if (!data.conversationId || !data.content) {
        socket.emit('error', { message: 'Invalid message data' })
        return
      }

      // For now, broadcast the message (in production, save to database first)
      const message = {
        id: `msg_${Date.now()}_${Math.random()}`,
        conversationId: data.conversationId,
        senderId: userId,
        senderName: userName,
        senderAvatar: userAvatar,
        content: data.content,
        type: data.type || 'text',
        status: 'sent',
        timestamp: new Date(),
        replyTo: data.replyTo,
        attachments: data.attachments
      }

      // Broadcast to conversation participants
      this.io.to(`conversation:${data.conversationId}`).emit('message_received', message)
      
      console.log(`Message sent in conversation ${data.conversationId}`)
      
    } catch (error) {
      console.error('Error handling message:', error)
      socket.emit('error', { message: 'Failed to send message' })
    }
  }

  handleTypingStart(socket, { conversationId }) {
    const { userId } = socket.authData
    socket.to(`conversation:${conversationId}`).emit('user_typing', {
      userId,
      conversationId,
      isTyping: true
    })
  }

  handleTypingStop(socket, { conversationId }) {
    const { userId } = socket.authData
    socket.to(`conversation:${conversationId}`).emit('user_typing', {
      userId,
      conversationId,
      isTyping: false
    })
  }

  handleMarkRead(socket, { conversationId, messageIds }) {
    const { userId } = socket.authData
    socket.to(`conversation:${conversationId}`).emit('messages_read', {
      userId,
      conversationId,
      messageIds,
      readAt: new Date()
    })
  }

  broadcastPresenceUpdate(userId, isOnline) {
    this.io.emit('presence_update', {
      userId,
      isOnline,
      lastSeen: new Date()
    })
  }

  addUserSocket(userId, socketId) {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set())
    }
    this.userSockets.get(userId).add(socketId)
  }

  removeUserSocket(userId, socketId) {
    const sockets = this.userSockets.get(userId)
    if (sockets) {
      sockets.delete(socketId)
      if (sockets.size === 0) {
        this.userSockets.delete(userId)
      }
    }
  }

  isUserOnline(userId) {
    return this.userSockets.has(userId) && this.userSockets.get(userId).size > 0
  }
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res)
  })

  // Initialize WebSocket service
  const wsService = new WebSocketService(server)

  const port = process.env.PORT || 3000
  server.listen(port, () => {
    console.log(`🚀 Ring Platform with WebSocket server running on http://localhost:${port}`)
    console.log(`📡 WebSocket server initialized and ready`)
  })
}) 