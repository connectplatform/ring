/**
 * WebSocket Diagnostics Provider
 * Client component wrapper to handle the diagnostics panel
 */

'use client'

import React from 'react'
import dynamic from 'next/dynamic'

// Dynamically import the diagnostics component (client-side only)
const WebSocketDiagnostics = dynamic(
  () => import('@/components/ui/websocket-diagnostics'),
  { 
    ssr: false,
    loading: () => null // No loading indicator needed
  }
)

export function WebSocketDiagnosticsProvider() {
  // Only render in development
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return <WebSocketDiagnostics />
}

export default WebSocketDiagnosticsProvider
