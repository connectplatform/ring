'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
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

  const connect = async () => {
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
  }

  const disconnect = () => {
    wsClient.disconnect()
    setIsConnected(false)
    setConnectionError(null)
  }

  useEffect(() => {
    if (status === 'authenticated' && session?.accessToken) {
      connect()
    } else if (status === 'unauthenticated') {
      disconnect()
    }

    // Event handlers
    const handleConnected = () => {
      setIsConnected(true)
      setConnectionError(null)
      setReconnecting(false)
      toast({
        title: 'Connected',
        description: 'Real-time features are now active',
        variant: 'default'
      })
    }

    const handleDisconnected = () => {
      setIsConnected(false)
      toast({
        title: 'Disconnected',
        description: 'Real-time features are temporarily unavailable',
        variant: 'destructive'
      })
    }

    const handleConnectionError = (error: any) => {
      setConnectionError(error.message)
      setIsConnected(false)
    }

    wsClient.on('connected', handleConnected)
    wsClient.on('disconnected', handleDisconnected)
    wsClient.on('connection_error', handleConnectionError)

    return () => {
      wsClient.off('connected', handleConnected)
      wsClient.off('disconnected', handleDisconnected)
      wsClient.off('connection_error', handleConnectionError)
    }
  }, [session, status])

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