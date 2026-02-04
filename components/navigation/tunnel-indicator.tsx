'use client'

/**
 * Tunnel Connection Indicator
 * Shows real-time connection status in the left sidebar
 * 
 * Green dot = Connected (real-time updates active)
 * Yellow dot = Connecting/Reconnecting
 * Red dot = Disconnected (falling back to polling)
 * 
 * @see AI-CONTEXT: tunnel-protocol-firebase-rtdb-analog-2025-11-07
 */

import { useTunnelStatus } from '@/hooks/use-tunnel-subscription'
import { TunnelConnectionState } from '@/lib/tunnel/types'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Wifi, WifiOff, Loader2 } from 'lucide-react'

interface TunnelIndicatorProps {
  className?: string
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function TunnelIndicator({ 
  className, 
  showLabel = false,
  size = 'sm' 
}: TunnelIndicatorProps) {
  const { isConnected, connectionState, latency } = useTunnelStatus()

  const getStatusColor = () => {
    switch (connectionState) {
      case TunnelConnectionState.CONNECTED:
        return 'bg-green-500'
      case TunnelConnectionState.CONNECTING:
      case TunnelConnectionState.RECONNECTING:
        return 'bg-yellow-500'
      case TunnelConnectionState.ERROR:
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusText = () => {
    switch (connectionState) {
      case TunnelConnectionState.CONNECTED:
        return latency ? `Connected (${latency}ms)` : 'Connected'
      case TunnelConnectionState.CONNECTING:
        return 'Connecting...'
      case TunnelConnectionState.RECONNECTING:
        return 'Reconnecting...'
      case TunnelConnectionState.ERROR:
        return 'Connection error'
      default:
        return 'Disconnected'
    }
  }

  const getIcon = () => {
    const iconSize = size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5'
    
    if (connectionState === TunnelConnectionState.CONNECTING || 
        connectionState === TunnelConnectionState.RECONNECTING) {
      return <Loader2 className={cn(iconSize, 'animate-spin text-yellow-500')} />
    }
    
    if (isConnected) {
      return <Wifi className={cn(iconSize, 'text-green-500')} />
    }
    
    return <WifiOff className={cn(iconSize, 'text-gray-500')} />
  }

  const dotSize = size === 'sm' ? 'w-2 h-2' : size === 'md' ? 'w-3 h-3' : 'w-4 h-4'

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            'flex items-center gap-1.5 cursor-default',
            className
          )}>
            {/* Animated pulse dot */}
            <div className="relative">
              <div className={cn(
                'rounded-full',
                dotSize,
                getStatusColor(),
                isConnected && 'animate-pulse'
              )} />
              {isConnected && (
                <div className={cn(
                  'absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75',
                  dotSize
                )} />
              )}
            </div>
            
            {showLabel && (
              <span className={cn(
                'text-xs text-muted-foreground',
                isConnected && 'text-green-600 dark:text-green-400'
              )}>
                {isConnected ? 'Live' : 'Offline'}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="flex items-center gap-2">
            {getIcon()}
            <span>{getStatusText()}</span>
          </div>
          {isConnected && (
            <p className="text-muted-foreground mt-1">
              Real-time updates active
            </p>
          )}
          {!isConnected && connectionState !== TunnelConnectionState.CONNECTING && (
            <p className="text-muted-foreground mt-1">
              Using polling fallback
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Compact tunnel indicator for bottom row of sidebar
 */
export function TunnelIndicatorCompact({ className }: { className?: string }) {
  const { isConnected, connectionState } = useTunnelStatus()

  const getStatusColor = () => {
    switch (connectionState) {
      case TunnelConnectionState.CONNECTED:
        return 'bg-green-500 shadow-green-500/50'
      case TunnelConnectionState.CONNECTING:
      case TunnelConnectionState.RECONNECTING:
        return 'bg-yellow-500 shadow-yellow-500/50'
      case TunnelConnectionState.ERROR:
        return 'bg-red-500 shadow-red-500/50'
      default:
        return 'bg-gray-500 shadow-gray-500/50'
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            'flex items-center justify-center',
            className
          )}>
            <div className={cn(
              'w-2 h-2 rounded-full shadow-lg',
              getStatusColor(),
              isConnected && 'animate-pulse'
            )} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="w-3 h-3 text-green-500" />
            ) : (
              <WifiOff className="w-3 h-3 text-gray-500" />
            )}
            <span>
              {isConnected ? 'Tunnel Connected' : 'Tunnel Disconnected'}
            </span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

