import io, { Socket } from 'socket.io-client'
import { Message, Conversation, ConversationParticipant } from '@/features/chat/types'

export interface WebSocketEvents {
  // Connection events
  connected: () => void
  disconnected: (reason: string) => void
  connection_error: (error: any) => void
  
  // Message events
  message_received: (message: Message) => void
  message_updated: (message: Message) => void
  message_deleted: (messageId: string) => void
  messages_read: (data: { userId: string; conversationId: string; messageIds: string[]; readAt: Date }) => void
  
  // Typing events
  user_typing: (data: { userId: string; conversationId: string; isTyping: boolean }) => void
  
  // Presence events
  presence_update: (data: { userId: string; isOnline: boolean; lastSeen: Date }) => void
  
  // Conversation events
  conversation_updated: (conversation: Conversation) => void
  participant_joined: (data: { conversationId: string; participant: ConversationParticipant }) => void
  participant_left: (data: { conversationId: string; userId: string }) => void
  
  // Error events
  error: (error: { message: string }) => void
}

export class WebSocketClient {
  private socket: Socket | null = null
  private eventHandlers: Map<string, Function[]> = new Map()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private connectionPromise: Promise<void> | null = null

  async connect(sessionToken: string): Promise<void> {
    if (this.socket?.connected) return
    if (this.connectionPromise) return this.connectionPromise

    this.connectionPromise = this.performConnection(sessionToken)
    return this.connectionPromise
  }

  private async performConnection(sessionToken: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 
                   (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')

      try {
        this.socket = io(wsUrl, {
          auth: { token: sessionToken },
          transports: ['websocket', 'polling'],
          timeout: 10000,
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: this.maxReconnectAttempts,
          forceNew: true,
          autoConnect: true
        })

        this.setupEventHandlers()

        this.socket.on('connect', () => {
          console.log('WebSocket connected successfully')
          this.reconnectAttempts = 0
          this.connectionPromise = null
          this.emit('connected')
          resolve()
        })

        this.socket.on('connect_error', (error) => {
          console.error('WebSocket connection error:', error.message || error)
          this.emit('connection_error', error)
          this.connectionPromise = null
          
          // Only reject if this is the first connection attempt
          if (this.reconnectAttempts === 0) {
            reject(new Error(`Connection failed: ${error.message || 'Unknown error'}`))
          }
        })

        this.socket.on('error', (error) => {
          console.error('WebSocket error:', error)
          this.emit('error', error)
        })

        // Timeout fallback
        const timeoutId = setTimeout(() => {
          if (!this.socket?.connected) {
            this.connectionPromise = null
            reject(new Error('Connection timeout after 10 seconds'))
          }
        }, 12000)

        // Clear timeout on successful connection
        this.socket.on('connect', () => {
          clearTimeout(timeoutId)
        })

      } catch (error) {
        console.error('Failed to create socket connection:', error)
        this.connectionPromise = null
        reject(error)
      }
    })
  }

  private setupEventHandlers() {
    if (!this.socket) return

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason)
      this.emit('disconnected', reason)
      this.connectionPromise = null
    })

    // Set up event forwarding for all WebSocket events
    const eventTypes: (keyof WebSocketEvents)[] = [
      'message_received', 'message_updated', 'message_deleted', 'messages_read',
      'user_typing', 'presence_update', 'conversation_updated', 
      'participant_joined', 'participant_left', 'error'
    ]

    eventTypes.forEach(eventType => {
      this.socket!.on(eventType, (data) => {
        this.emit(eventType, data)
      })
    })
  }

  // Event management
  on<K extends keyof WebSocketEvents>(event: K, handler: WebSocketEvents[K]): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event)!.push(handler)
  }

  off<K extends keyof WebSocketEvents>(event: K, handler: WebSocketEvents[K]): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  private emit(event: string, data?: any): void {
    const handlers = this.eventHandlers.get(event) || []
    handlers.forEach(handler => {
      try {
        handler(data)
      } catch (error) {
        console.error(`Error in WebSocket event handler for ${event}:`, error)
      }
    })
  }

  // Connection status
  get isConnected(): boolean {
    return this.socket?.connected || false
  }

  get isConnecting(): boolean {
    return this.connectionPromise !== null
  }

  // Message operations
  joinConversation(conversationId: string): void {
    if (!this.socket?.connected) {
      console.warn('Cannot join conversation: WebSocket not connected')
      return
    }
    this.socket.emit('join_conversation', conversationId)
  }

  leaveConversation(conversationId: string): void {
    if (!this.socket?.connected) {
      console.warn('Cannot leave conversation: WebSocket not connected')
      return
    }
    this.socket.emit('leave_conversation', conversationId)
  }

  sendMessage(message: Omit<Message, 'id' | 'timestamp' | 'status'>): void {
    if (!this.socket?.connected) {
      console.warn('Cannot send message: WebSocket not connected')
      return
    }
    this.socket.emit('send_message', message)
  }

  startTyping(conversationId: string): void {
    if (!this.socket?.connected) return
    this.socket.emit('typing_start', { conversationId })
  }

  stopTyping(conversationId: string): void {
    if (!this.socket?.connected) return
    this.socket.emit('typing_stop', { conversationId })
  }

  markAsRead(conversationId: string, messageIds: string[]): void {
    if (!this.socket?.connected) return
    this.socket.emit('mark_read', { conversationId, messageIds })
  }

  // Connection management
  async reconnect(sessionToken: string): Promise<void> {
    this.disconnect()
    await this.connect(sessionToken)
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.eventHandlers.clear()
    this.connectionPromise = null
    this.reconnectAttempts = 0
  }

  // Utility methods
  getConnectionState(): 'connected' | 'connecting' | 'disconnected' {
    if (this.isConnected) return 'connected'
    if (this.isConnecting) return 'connecting'
    return 'disconnected'
  }
}

// Singleton WebSocket client instance
let wsClientInstance: WebSocketClient | null = null

export const wsClient = {
  getInstance(): WebSocketClient {
    if (!wsClientInstance) {
      wsClientInstance = new WebSocketClient()
    }
    return wsClientInstance
  },

  async connect(sessionToken: string): Promise<void> {
    return this.getInstance().connect(sessionToken)
  },

  disconnect(): void {
    this.getInstance().disconnect()
  },

  on<K extends keyof WebSocketEvents>(event: K, handler: WebSocketEvents[K]): void {
    this.getInstance().on(event, handler)
  },

  off<K extends keyof WebSocketEvents>(event: K, handler: WebSocketEvents[K]): void {
    this.getInstance().off(event, handler)
  },

  get isConnected(): boolean {
    return wsClientInstance?.isConnected || false
  },

  get isConnecting(): boolean {
    return wsClientInstance?.isConnecting || false
  },

  // Message operations
  joinConversation(conversationId: string): void {
    this.getInstance().joinConversation(conversationId)
  },

  leaveConversation(conversationId: string): void {
    this.getInstance().leaveConversation(conversationId)
  },

  sendMessage(message: Omit<Message, 'id' | 'timestamp' | 'status'>): void {
    this.getInstance().sendMessage(message)
  },

  startTyping(conversationId: string): void {
    this.getInstance().startTyping(conversationId)
  },

  stopTyping(conversationId: string): void {
    this.getInstance().stopTyping(conversationId)
  },

  markAsRead(conversationId: string, messageIds: string[]): void {
    this.getInstance().markAsRead(conversationId, messageIds)
  }
}

// Export singleton instance (backward compatibility)
export default wsClient 