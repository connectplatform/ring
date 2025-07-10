'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { wsClient } from '@/lib/websocket-client'
import { toast } from '@/hooks/use-toast'

interface WebSocketContextType {
  isConnected: boolean
  connectionError: string | null
  reconnecting: boolean
  connect: () => Promise<void>
  disconnect: () => void
}

const WebSocketContext = createContext<WebSocketContextType | null>(null)

export function useWebSocketContext() {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocketContext must be used within WebSocketProvider')
  }
  return context
}

interface WebSocketProviderProps {
  children: React.ReactNode
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const { data: session, status } = useSession()
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [reconnecting, setReconnecting] = useState(false)

  const connect = useCallback(async () => {
    if (!session?.accessToken || status !== 'authenticated') return

    try {
      setReconnecting(true)
      setConnectionError(null)
      await wsClient.connect(session.accessToken)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed'
      setConnectionError(errorMessage)
      toast({
        title: 'Connection Error',
        description: 'Failed to connect to real-time services',
        variant: 'destructive'
      })
    } finally {
      setReconnecting(false)
    }
  }, [session?.accessToken, status])

  const disconnect = useCallback(() => {
    wsClient.disconnect()
    setIsConnected(false)
    setConnectionError(null)
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && session?.accessToken) {
      connect()
    } else if (status === 'unauthenticated') {
      disconnect()
    }

    // Event handlers with error boundary
    const handleConnected = () => {
      try {
        setIsConnected(true)
        setConnectionError(null)
        setReconnecting(false)
        console.log('WebSocket connected successfully')
      } catch (error) {
        console.error('Error in connected handler:', error)
      }
    }

    const handleDisconnected = (reason: string) => {
      try {
        setIsConnected(false)
        console.log('WebSocket disconnected:', reason)
        
        // Only show toast for unexpected disconnections
        if (reason !== 'io client disconnect' && reason !== 'transport close') {
          toast({
            title: 'Connection Lost',
            description: 'Attempting to reconnect...',
            variant: 'destructive'
          })
        }
      } catch (error) {
        console.error('Error in disconnected handler:', error)
      }
    }

    const handleConnectionError = (error: any) => {
      try {
        const errorMessage = error?.message || 'Connection failed'
        setConnectionError(errorMessage)
        setIsConnected(false)
        console.error('WebSocket connection error:', errorMessage)
      } catch (handlerError) {
        console.error('Error in connection error handler:', handlerError)
      }
    }

    wsClient.on('connected', handleConnected)
    wsClient.on('disconnected', handleDisconnected)
    wsClient.on('connection_error', handleConnectionError)

    return () => {
      try {
        wsClient.off('connected', handleConnected)
        wsClient.off('disconnected', handleDisconnected)
        wsClient.off('connection_error', handleConnectionError)
      } catch (error) {
        console.error('Error cleaning up WebSocket event handlers:', error)
      }
    }
  }, [session?.accessToken, status, connect, disconnect])

  const contextValue: WebSocketContextType = {
    isConnected,
    connectionError,
    reconnecting,
    connect,
    disconnect
  }

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  )
} 