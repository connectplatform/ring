/**
 * Modern WebSocket Manager with React 19 optimizations
 * Implements heartbeat, auto-reconnection, and push notifications
 */

import { io, Socket } from 'socket.io-client'
import { EventEmitter } from 'events'

export interface WebSocketConfig {
  url?: string
  reconnectDelay?: number
  maxReconnectAttempts?: number
  heartbeatInterval?: number
  tokenRefreshInterval?: number
}

export interface WebSocketState {
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'
  lastConnected?: Date
  lastError?: string
  reconnectAttempts: number
  isAuthenticated: boolean
  connectionStartTime?: Date
  uptime?: number // seconds
  totalConnections?: number
  totalDisconnections?: number
}

interface NotificationData {
  id: string
  type: 'notification' | 'message' | 'alert' | 'system'
  title: string
  body: string
  timestamp: Date
  priority: 'low' | 'normal' | 'high' | 'urgent'
  data?: any
}

export class WebSocketManager extends EventEmitter {
  private socket: Socket | null = null
  private config: Required<WebSocketConfig>
  private state: WebSocketState
  private heartbeatTimer?: NodeJS.Timeout
  private tokenRefreshTimer?: NodeJS.Timeout
  private reconnectTimer?: NodeJS.Timeout
  private uptimeTimer?: NodeJS.Timeout
  private currentToken: string | null = null
  private tokenExpiry: number = 0
  private connectionPromise: Promise<void> | null = null
  private connectionStartTime?: Date
  private totalConnections: number = 0
  private totalDisconnections: number = 0
  
  constructor(config: WebSocketConfig = {}) {
    super()
    
    // Check if WebSocket is disabled (e.g., on Vercel)
    const isWebSocketDisabled = process.env.NEXT_PUBLIC_TUNNEL_WEBSOCKET_ENABLED === 'false' ||
                                process.env.NEXT_PUBLIC_TUNNEL_TRANSPORT === 'sse' ||
                                process.env.NEXT_PUBLIC_TUNNEL_TRANSPORT === 'supabase';
    
    if (isWebSocketDisabled) {
      console.log('[WebSocketManager] WebSocket disabled by configuration, using tunnel transport instead');
      this.state = {
        status: 'disconnected',
        reconnectAttempts: 0,
        isAuthenticated: false,
        totalConnections: 0,
        totalDisconnections: 0,
      }
      // Don't initialize anything else if WebSocket is disabled
      return;
    }
    
    this.config = {
      url: config.url || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'),
      reconnectDelay: config.reconnectDelay || 1000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      heartbeatInterval: config.heartbeatInterval || 30000, // 30 seconds
      tokenRefreshInterval: config.tokenRefreshInterval || 50 * 60 * 1000, // 50 minutes
    }
    
    this.state = {
      status: 'disconnected',
      reconnectAttempts: 0,
      isAuthenticated: false,
      totalConnections: 0,
      totalDisconnections: 0,
    }
    
    this.setupVisibilityHandlers()
    this.setupNetworkHandlers()
  }

  /**
   * Get WebSocket authentication token from API
   * Falls back to tunnel token for anonymous users
   */
  private async fetchAuthToken(): Promise<string> {
    try {
      // First try the WebSocket auth endpoint for authenticated users
      const response = await fetch('/api/websocket/auth', {
        method: 'GET',
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        this.currentToken = data.token
        this.tokenExpiry = Date.now() + (data.expiresIn * 1000)
        return data.token
      }

      // If WebSocket auth fails (401), try tunnel token for anonymous users
      if (response.status === 401) {
        console.log('[WebSocketManager] WebSocket auth failed, trying tunnel token for anonymous connection')
        
        const tunnelResponse = await fetch('/api/tunnel/token', {
          method: 'POST',
          credentials: 'include',
        })

        if (tunnelResponse.ok) {
          const tunnelData = await tunnelResponse.json()
          this.currentToken = tunnelData.token
          this.tokenExpiry = Date.now() + (tunnelData.expiresIn * 1000)
          
          console.log(`[WebSocketManager] Using ${tunnelData.anonymous ? 'anonymous' : 'authenticated'} tunnel token`)
          return tunnelData.token
        }
      }

      throw new Error(`Auth failed: ${response.status}`)
    } catch (error) {
      console.error('Failed to fetch WebSocket auth token:', error)
      throw error
    }
  }

  /**
   * Connect to WebSocket server with authentication
   */
  async connect(): Promise<void> {
    // Check if WebSocket is disabled
    const isWebSocketDisabled = process.env.NEXT_PUBLIC_TUNNEL_WEBSOCKET_ENABLED === 'false' ||
                                process.env.NEXT_PUBLIC_TUNNEL_TRANSPORT === 'sse' ||
                                process.env.NEXT_PUBLIC_TUNNEL_TRANSPORT === 'supabase';
    
    if (isWebSocketDisabled) {
      console.log('[WebSocketManager] WebSocket disabled, skipping connection');
      return Promise.resolve();
    }

    if (this.state.status === 'connected') return
    if (this.connectionPromise) return this.connectionPromise

    this.connectionPromise = this.performConnection()
    return this.connectionPromise
  }

  private async performConnection(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        this.updateState({ status: 'connecting' })

        // Get fresh auth token
        const token = await this.fetchAuthToken()
        
        // Create socket connection with auth token
        this.socket = io(this.config.url, {
          auth: { token },
          transports: ['websocket'], // Prefer WebSocket over polling
          reconnection: false, // We handle reconnection manually
          timeout: 10000,
          forceNew: true,
        })

        this.setupSocketHandlers()

        // Connection success handler
        this.socket.once('connect', () => {
          console.log('✅ WebSocket connected successfully')
          
          // Track connection metrics
          this.connectionStartTime = new Date()
          this.totalConnections++
          
          this.updateState({
            status: 'connected',
            lastConnected: new Date(),
            connectionStartTime: this.connectionStartTime,
            reconnectAttempts: 0,
            isAuthenticated: true,
            totalConnections: this.totalConnections,
            uptime: 0,
          })
          
          this.startHeartbeat()
          this.startTokenRefresh()
          this.startUptimeTracking()
          this.connectionPromise = null
          
          this.emit('connected')
          resolve()
        })

        // Connection error handler
        this.socket.once('connect_error', (error) => {
          console.error('❌ WebSocket connection error:', error.message)
          this.updateState({
            status: 'error',
            lastError: error.message,
            isAuthenticated: false,
          })
          
          this.connectionPromise = null
          this.scheduleReconnect()
          
          reject(new Error(error.message))
        })

        // Set connection timeout
        const timeoutId = setTimeout(() => {
          if (this.state.status !== 'connected') {
            this.socket?.disconnect()
            this.connectionPromise = null
            reject(new Error('Connection timeout'))
          }
        }, 15000)

        this.socket.once('connect', () => clearTimeout(timeoutId))

      } catch (error) {
        console.error('Failed to connect:', error)
        this.connectionPromise = null
        this.updateState({ status: 'error', lastError: (error as Error).message })
        reject(error)
      }
    })
  }

  /**
   * Setup socket event handlers
   */
  private setupSocketHandlers() {
    if (!this.socket) return

    // Handle disconnection
    this.socket.on('disconnect', (reason) => {
      console.warn('🔌 WebSocket disconnected:', reason)
      
      // Track disconnection metrics
      this.totalDisconnections++
      this.connectionStartTime = undefined
      
      this.updateState({ 
        status: 'disconnected', 
        isAuthenticated: false,
        totalDisconnections: this.totalDisconnections,
        uptime: undefined,
      })
      
      this.stopHeartbeat()
      this.stopTokenRefresh()
      this.stopUptimeTracking()
      
      // Auto-reconnect for non-intentional disconnections
      if (reason !== 'io client disconnect') {
        this.scheduleReconnect()
      }
      
      this.emit('disconnected', reason)
    })

    // Handle server-side errors
    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error)
      this.emit('error', error)
    })

    // Handle heartbeat response
    this.socket.on('pong', () => {
      this.emit('heartbeat')
    })

    // **NOTIFICATION HANDLERS** - Convert polling to push
    this.socket.on('notification', (data: NotificationData) => {
      console.log('📬 New notification received:', data.title)
      this.emit('notification', data)
    })

    this.socket.on('notification:batch', (notifications: NotificationData[]) => {
      console.log(`📬 Received ${notifications.length} notifications`)
      this.emit('notifications', notifications)
    })

    this.socket.on('notification:unread_count', (count: number) => {
      this.emit('unreadCount', count)
    })

    // Message handlers
    this.socket.on('message', (data) => {
      this.emit('message', data)
    })

    // Typing indicators
    this.socket.on('typing', (data) => {
      this.emit('typing', data)
    })

    // Presence updates
    this.socket.on('presence', (data) => {
      this.emit('presence', data)
    })

    // System events
    this.socket.on('system:maintenance', (data) => {
      console.warn('⚠️ System maintenance:', data)
      this.emit('maintenance', data)
    })

    this.socket.on('system:update', (data) => {
      this.emit('systemUpdate', data)
    })
  }

  /**
   * Heartbeat mechanism to keep connection alive
   */
  private startHeartbeat() {
    this.stopHeartbeat()
    
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping')
        this.emit('ping')
      } else {
        this.stopHeartbeat()
        this.scheduleReconnect()
      }
    }, this.config.heartbeatInterval)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = undefined
    }
  }

  /**
   * Token refresh mechanism - OPTIMIZED to prevent reconnection loops
   */
  private startTokenRefresh() {
    this.stopTokenRefresh()
    
    this.tokenRefreshTimer = setInterval(async () => {
      try {
        // Refresh token before it expires
        const timeUntilExpiry = this.tokenExpiry - Date.now()
        if (timeUntilExpiry < 10 * 60 * 1000) { // Less than 10 minutes
          const newToken = await this.fetchAuthToken()
          
          // FIXED: Update socket auth WITHOUT disconnection to prevent subscription loops
          if (this.socket?.connected) {
            // Send auth update event instead of reconnecting
            this.socket.emit('auth:refresh', { token: newToken })
            this.socket.auth = { token: newToken }
            
            console.log('🔄 WebSocket token refreshed')
            
            // Listen for confirmation from server
            this.socket.once('auth:refreshed', (response) => {
              if (response.success) {
                console.log('✅ Server confirmed token refresh')
              } else {
                console.warn('❌ Token refresh rejected by server, reconnecting...')
                // Only reconnect if server explicitly rejects the refresh
                this.scheduleReconnect()
              }
            })
            
            // Set timeout for server response - reconnect if no response
            setTimeout(() => {
              if (this.socket?.connected) {
                console.log('⚠️ Token refresh timeout - server didn\'t respond')
              }
            }, 5000)
          }
        }
      } catch (error) {
        console.error('Token refresh failed:', error)
        // Only reconnect on auth failure, not on successful refresh
        if (error.message.includes('auth') || error.message.includes('401')) {
          this.scheduleReconnect()
        }
      }
    }, this.config.tokenRefreshInterval)
  }

  private stopTokenRefresh() {
    if (this.tokenRefreshTimer) {
      clearInterval(this.tokenRefreshTimer)
      this.tokenRefreshTimer = undefined
    }
  }

  /**
   * Track connection uptime
   */
  private startUptimeTracking() {
    this.stopUptimeTracking()
    
    this.uptimeTimer = setInterval(() => {
      if (this.connectionStartTime && this.state.status === 'connected') {
        const uptimeSeconds = Math.floor((Date.now() - this.connectionStartTime.getTime()) / 1000)
        this.updateState({ uptime: uptimeSeconds })
      }
    }, 1000) // Update every second
  }

  private stopUptimeTracking() {
    if (this.uptimeTimer) {
      clearInterval(this.uptimeTimer)
      this.uptimeTimer = undefined
    }
  }

  /**
   * Smart reconnection with exponential backoff
   */
  private scheduleReconnect() {
    if (this.state.status === 'reconnecting') return
    if (this.state.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      this.updateState({ status: 'error', lastError: 'Max reconnection attempts reached' })
      return
    }

    const delay = Math.min(
      this.config.reconnectDelay * Math.pow(2, this.state.reconnectAttempts),
      30000 // Max 30 seconds
    )

    console.log(`Reconnecting in ${delay / 1000} seconds...`)
    this.updateState({ 
      status: 'reconnecting',
      reconnectAttempts: this.state.reconnectAttempts + 1
    })

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnection failed:', error)
      })
    }, delay)
  }

  /**
   * Handle tab visibility changes
   */
  private setupVisibilityHandlers() {
    if (typeof document === 'undefined') return

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.state.status === 'disconnected') {
        // Reconnect when tab becomes visible
        this.connect().catch(console.error)
      }
    })

    // Handle page unload
    window.addEventListener('beforeunload', () => {
      this.disconnect()
    })
  }

  /**
   * Handle network status changes
   */
  private setupNetworkHandlers() {
    if (typeof window === 'undefined') return

    window.addEventListener('online', () => {
      console.log('🌐 Network online - reconnecting WebSocket')
      if (this.state.status === 'disconnected' || this.state.status === 'error') {
        this.connect().catch(console.error)
      }
    })

    window.addEventListener('offline', () => {
      console.log('📵 Network offline')
      this.disconnect()
    })
  }

  /**
   * Update internal state and emit changes
   */
  private updateState(updates: Partial<WebSocketState>) {
    this.state = { ...this.state, ...updates }
    this.emit('stateChange', this.state)
  }

  /**
   * Subscribe to notifications for a specific topic
   */
  subscribe(topic: string) {
    if (this.socket?.connected) {
      this.socket.emit('subscribe', { topic })
    }
  }

  /**
   * Unsubscribe from a topic
   */
  unsubscribe(topic: string) {
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe', { topic })
    }
  }

  /**
   * Send a message through WebSocket
   */
  send(event: string, data: any) {
    if (!this.socket?.connected) {
      console.warn('Cannot send message: WebSocket not connected')
      return false
    }
    
    this.socket.emit(event, data)
    return true
  }

  /**
   * Request notification count
   */
  requestNotificationCount() {
    this.send('notification:get_count', {})
  }

  /**
   * Mark notifications as read
   */
  markNotificationsRead(notificationIds: string[]) {
    this.send('notification:mark_read', { ids: notificationIds })
  }

  /**
   * Clean disconnect
   */
  disconnect() {
    this.stopHeartbeat()
    this.stopTokenRefresh()
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = undefined
    }

    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }

    this.updateState({ 
      status: 'disconnected',
      isAuthenticated: false,
      reconnectAttempts: 0
    })
  }

  /**
   * Get current state
   * Returns the actual state object for stable reference in useSyncExternalStore
   */
  getState(): WebSocketState {
    return this.state
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.state.status === 'connected' && this.socket?.connected === true
  }
}

// Singleton instance
let managerInstance: WebSocketManager | null = null

export const websocketManager = {
  getInstance(): WebSocketManager {
    if (!managerInstance) {
      managerInstance = new WebSocketManager()
    }
    return managerInstance
  },

  async connect(): Promise<void> {
    return this.getInstance().connect()
  },

  disconnect(): void {
    this.getInstance().disconnect()
  },

  on(event: string, handler: Function): void {
    this.getInstance().on(event, handler)
  },

  off(event: string, handler: Function): void {
    this.getInstance().off(event, handler)
  },

  send(event: string, data: any): boolean {
    return this.getInstance().send(event, data)
  },

  subscribe(topic: string): void {
    this.getInstance().subscribe(topic)
  },

  unsubscribe(topic: string): void {
    this.getInstance().unsubscribe(topic)
  },

  requestNotificationCount(): void {
    this.getInstance().requestNotificationCount()
  },

  markNotificationsRead(notificationIds: string[]): void {
    this.getInstance().markNotificationsRead(notificationIds)
  },

  get isConnected(): boolean {
    return this.getInstance().isConnected
  },

  getState(): WebSocketState {
    return this.getInstance().getState()
  }
}

export default websocketManager
