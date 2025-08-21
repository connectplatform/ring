/**
 * WebSocket Diagnostics Component
 * Shows real-time WebSocket connection stats and debugging info
 */

'use client'

import React, { useEffect, useState } from 'react'
import { useWebSocket } from '@/components/providers/websocket-provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Activity, Wifi, WifiOff, Clock, Server, AlertCircle, CheckCircle } from 'lucide-react'

export function WebSocketDiagnostics({ className = '' }: { className?: string }) {
  const ws = useWebSocket()
  const [showDetails, setShowDetails] = useState(false)
  const [localUptime, setLocalUptime] = useState(0)

  // Track local uptime
  useEffect(() => {
    const startTime = Date.now()
    const interval = setInterval(() => {
      setLocalUptime(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Format uptime display
  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    }
    return `${secs}s`
  }

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-500'
      case 'connecting': return 'text-yellow-500'
      case 'reconnecting': return 'text-orange-500'
      case 'disconnected': return 'text-red-500'
      case 'error': return 'text-red-700'
      default: return 'text-gray-500'
    }
  }

  // Get quality badge variant
  const getQualityVariant = (quality: string): 'default' | 'secondary' | 'destructive' => {
    switch (quality) {
      case 'excellent': return 'default'
      case 'good': return 'secondary'
      case 'poor': return 'destructive'
      default: return 'secondary'
    }
  }

  // Only show in development mode
  if (process.env.NODE_ENV === 'production' && !showDetails) {
    return null
  }

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      {/* Floating toggle button */}
      <Button
        onClick={() => setShowDetails(!showDetails)}
        size="sm"
        variant="outline"
        className="mb-2 shadow-lg"
      >
        {ws.isConnected ? (
          <Wifi className="h-4 w-4 mr-2 text-green-500" />
        ) : (
          <WifiOff className="h-4 w-4 mr-2 text-red-500" />
        )}
        WebSocket Debug
      </Button>

      {/* Diagnostic panel */}
      {showDetails && (
        <Card className="w-96 shadow-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <span className="flex items-center">
                <Activity className="h-4 w-4 mr-2" />
                WebSocket Diagnostics
              </span>
              <Badge className={getStatusColor(ws.status)}>
                {ws.status.toUpperCase()}
              </Badge>
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-3 text-xs">
            {/* Connection Status */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center">
                {ws.isConnected ? (
                  <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                ) : (
                  <AlertCircle className="h-3 w-3 mr-1 text-red-500" />
                )}
                <span>Connection:</span>
              </div>
              <span className={`font-mono ${getStatusColor(ws.status)}`}>
                {ws.status}
              </span>
            </div>

            {/* Connection Quality */}
            <div className="grid grid-cols-2 gap-2">
              <span>Quality:</span>
              <Badge variant={getQualityVariant(ws.system.connectionQuality)} className="text-xs">
                {ws.system.connectionQuality}
              </Badge>
            </div>

            {/* Uptime */}
            <div className="grid grid-cols-2 gap-2">
              <span className="flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                Session Uptime:
              </span>
              <span className="font-mono">
                {formatUptime(localUptime)}
              </span>
            </div>

            {/* Reconnect Attempts */}
            {ws.reconnectAttempts > 0 && (
              <div className="grid grid-cols-2 gap-2">
                <span>Reconnect Attempts:</span>
                <span className="font-mono text-orange-500">
                  {ws.reconnectAttempts}
                </span>
              </div>
            )}

            {/* Last Connected */}
            {ws.lastConnected && (
              <div className="grid grid-cols-2 gap-2">
                <span>Last Connected:</span>
                <span className="font-mono text-xs">
                  {new Date(ws.lastConnected).toLocaleTimeString()}
                </span>
              </div>
            )}

            {/* Notifications */}
            <div className="border-t pt-2">
              <div className="grid grid-cols-2 gap-2">
                <span>Unread Notifications:</span>
                <Badge variant="secondary" className="text-xs">
                  {ws.notifications.unreadCount}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <span>Total Received:</span>
                <span className="font-mono">
                  {ws.notifications.items.length}
                </span>
              </div>
            </div>

            {/* Presence */}
            <div className="border-t pt-2">
              <div className="grid grid-cols-2 gap-2">
                <span>Online Users:</span>
                <Badge variant="default" className="text-xs">
                  {ws.presence.onlineCount}
                </Badge>
              </div>
            </div>

            {/* System Status */}
            {ws.system.maintenanceMode && (
              <div className="border-t pt-2">
                <Badge variant="destructive" className="w-full">
                  ⚠️ Maintenance Mode Active
                </Badge>
              </div>
            )}

            {/* Connection Error */}
            {ws.connectionError && (
              <div className="border-t pt-2">
                <div className="text-red-500 text-xs break-words">
                  Error: {ws.connectionError}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="border-t pt-2 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => ws.connect()}
                disabled={ws.isConnected || ws.isConnecting}
                className="flex-1 text-xs"
              >
                {ws.isConnecting ? 'Connecting...' : 'Connect'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => ws.disconnect()}
                disabled={!ws.isConnected}
                className="flex-1 text-xs"
              >
                Disconnect
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => ws.notifications.refresh()}
                disabled={!ws.isConnected}
                className="text-xs"
              >
                Refresh
              </Button>
            </div>

            {/* Debug Info */}
            <div className="border-t pt-2 text-xs text-muted-foreground">
              <div>Environment: {process.env.NODE_ENV}</div>
              <div>WebSocket URL: {process.env.NEXT_PUBLIC_WS_URL || 'Default'}</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default WebSocketDiagnostics
