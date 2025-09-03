/**
 * WebSocket Diagnostics Component
 * Shoconnection real-time WebSocket connection stats and debugging info
 */

'use client'

import React, { useEffect, useState } from 'react'
import { useTunnelContext } from '@/components/providers/tunnel-provider'
import { TunnelConnectionState } from '@/lib/tunnel/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Activity, Wifi, WifiOff, Clock, Server, AlertCircle, CheckCircle } from 'lucide-react'

export function WebSocketDiagnostics({ className = '' }: { className?: string }) {
  // Use the Tunnel context directly to avoid duplicate subscriptions
  const {
    isConnected,
    connectionState,
    provider,
    connect,
    disconnect,
    health,
    latency,
    error
  } = useTunnelContext()
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

  // Map connection state to status string
  const status = isConnected ? 'connected' : 
                connectionState === TunnelConnectionState.CONNECTING ? 'connecting' :
                connectionState === TunnelConnectionState.RECONNECTING ? 'reconnecting' :  
                connectionState === TunnelConnectionState.ERROR ? 'error' :
                'disconnected'

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

  // Get connection quality based on latency
  const connectionQuality = latency < 100 ? 'excellent' : 
                           latency < 300 ? 'good' : 
                           latency < 1000 ? 'fair' : 'poor'

  // Get quality badge variant
  const getQualityVariant = (quality: string): 'default' | 'secondary' | 'destructive' => {
    switch (quality) {
      case 'excellent': return 'default'
      case 'good': return 'secondary'
      case 'fair': return 'secondary'
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
        {isConnected ? (
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
              <Badge className={getStatusColor(status)}>
                {status.toUpperCase()}
              </Badge>
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-3 text-xs">
            {/* Connection Status */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center">
                {isConnected ? (
                  <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                ) : (
                  <AlertCircle className="h-3 w-3 mr-1 text-red-500" />
                )}
                <span>Connection:</span>
              </div>
              <span className={`font-mono ${getStatusColor(status)}`}>
                {status}
              </span>
            </div>

            {/* Connection Quality */}
            <div className="grid grid-cols-2 gap-2">
              <span>Quality:</span>
              <Badge variant={getQualityVariant(connectionQuality)} className="text-xs">
                {connectionQuality}
              </Badge>
            </div>

            {/* Latency */}
            <div className="grid grid-cols-2 gap-2">
              <span>Latency:</span>
              <span className="font-mono text-xs">
                {latency}ms
              </span>
            </div>

            {/* Provider */}
            {provider && (
              <div className="grid grid-cols-2 gap-2">
                <span>Provider:</span>
                <Badge variant="outline" className="text-xs">
                  {provider}
                </Badge>
              </div>
            )}

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

            {/* Health Status */}
            {health && (
              <div className="grid grid-cols-2 gap-2">
                <span>Health:</span>
                <Badge variant={health.state === TunnelConnectionState.CONNECTED ? 'default' : 'destructive'} className="text-xs">
                  {health.state}
                </Badge>
              </div>
            )}

            {/* Connection Info */}
            <div className="border-t pt-2">
              <div className="grid grid-cols-2 gap-2">
                <span>Connection State:</span>
                <span className="font-mono text-xs">
                  {connectionState}
                </span>
              </div>
            </div>

            {/* Connection Error */}
            {error && (
              <div className="border-t pt-2">
                <div className="text-red-500 text-xs break-words">
                  Error: {error.message || String(error)}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="border-t pt-2 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => connect()}
                disabled={isConnected || status === 'connecting'}
                className="flex-1 text-xs"
              >
                {status === 'connecting' ? 'Connecting...' : 'Connect'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => disconnect()}
                disabled={!isConnected}
                className="flex-1 text-xs"
              >
                Disconnect
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
