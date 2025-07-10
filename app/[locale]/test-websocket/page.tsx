'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import { Wifi, WifiOff, MessageCircle, Send, User } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useWebSocketContext } from '@/components/providers/websocket-provider'
import { useWebSocket, useRealTimeMessages } from '@/hooks/use-websocket'

export default function TestWebSocketPage() {
  const { data: session } = useSession()
  const { isConnected, connectionError, reconnecting, connect, disconnect } = useWebSocketContext()
  const { isConnected: wsConnected, isConnecting, error, wsClient } = useWebSocket()
  const { messages, sendMessage } = useRealTimeMessages('test-conversation')
  
  const [testMessage, setTestMessage] = useState('')
  const [connectionLog, setConnectionLog] = useState<string[]>([])
  const [testResults, setTestResults] = useState<{
    connectionTest: boolean | null
    messageTest: boolean | null
    reconnectionTest: boolean | null
  }>({
    connectionTest: null,
    messageTest: null, 
    reconnectionTest: null
  })

  useEffect(() => {
    const log = (message: string) => {
      setConnectionLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
    }

    if (isConnected || wsConnected) {
      log('✅ WebSocket connected successfully')
      setTestResults(prev => ({ ...prev, connectionTest: true }))
    } else if (connectionError || error) {
      log(`❌ Connection error: ${connectionError || error}`)
      setTestResults(prev => ({ ...prev, connectionTest: false }))
    }

    if (reconnecting || isConnecting) {
      log('🔄 Reconnecting...')
    }
  }, [isConnected, wsConnected, connectionError, error, reconnecting, isConnecting])

  const handleTestConnection = async () => {
    setConnectionLog([])
    setTestResults({
      connectionTest: null,
      messageTest: null,
      reconnectionTest: null
    })
    
    try {
      await connect()
    } catch (error) {
      console.error('Connection test failed:', error)
    }
  }

  const handleTestMessage = async () => {
    if (!testMessage.trim()) return

    try {
      sendMessage(testMessage, 'text')
      setTestMessage('')
      setTestResults(prev => ({ ...prev, messageTest: true }))
      setConnectionLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ✅ Message sent successfully`])
    } catch (error) {
      setTestResults(prev => ({ ...prev, messageTest: false }))
      setConnectionLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ❌ Message send failed`])
    }
  }

  const handleTestReconnection = () => {
    setConnectionLog(prev => [...prev, `${new Date().toLocaleTimeString()}: 🔄 Testing reconnection...`])
    disconnect()
    setTimeout(() => {
      connect()
    }, 1000)
  }

  const actualConnectionStatus = isConnected || wsConnected
  const actualConnectionError = connectionError || error

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              WebSocket Connection Test
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Connection Status */}
              <div className="flex items-center gap-2">
                {actualConnectionStatus ? (
                  <Wifi className="w-5 h-5 text-green-500" />
                ) : (
                  <WifiOff className="w-5 h-5 text-red-500" />
                )}
                <span className="font-medium">
                  Status: {actualConnectionStatus ? 'Connected' : 'Disconnected'}
                </span>
                <Badge variant={actualConnectionStatus ? 'default' : 'destructive'}>
                  {actualConnectionStatus ? 'Online' : 'Offline'}
                </Badge>
              </div>

              {/* User Info */}
              <div className="flex items-center gap-2">
                <User className="w-5 h-5" />
                <span>
                  User: {session?.user?.email || 'Not authenticated'}
                </span>
              </div>

              {/* Connection Error */}
              {actualConnectionError && (
                <Alert variant="destructive">
                  <AlertDescription>{actualConnectionError}</AlertDescription>
                </Alert>
              )}

              {/* Test Controls */}
              <div className="flex gap-2">
                <Button onClick={handleTestConnection} disabled={reconnecting || isConnecting}>
                  {(reconnecting || isConnecting) ? 'Connecting...' : 'Test Connection'}
                </Button>
                <Button onClick={handleTestReconnection} disabled={!actualConnectionStatus}>
                  Test Reconnection
                </Button>
              </div>

              {/* Message Test */}
              <div className="space-y-2">
                <h3 className="font-medium">Message Test</h3>
                <div className="flex gap-2">
                  <Input
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    placeholder="Type a test message..."
                    onKeyPress={(e) => e.key === 'Enter' && handleTestMessage()}
                  />
                  <Button onClick={handleTestMessage} disabled={!actualConnectionStatus}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Test Results */}
              <div className="space-y-2">
                <h3 className="font-medium">Test Results</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      testResults.connectionTest === true ? 'bg-green-500' :
                      testResults.connectionTest === false ? 'bg-red-500' : 'bg-gray-300'
                    }`} />
                    <span className="text-sm">Connection Test</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      testResults.messageTest === true ? 'bg-green-500' :
                      testResults.messageTest === false ? 'bg-red-500' : 'bg-gray-300'
                    }`} />
                    <span className="text-sm">Message Test</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      testResults.reconnectionTest === true ? 'bg-green-500' :
                      testResults.reconnectionTest === false ? 'bg-red-500' : 'bg-gray-300'
                    }`} />
                    <span className="text-sm">Reconnection Test</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Connection Log */}
        <Card>
          <CardHeader>
            <CardTitle>Connection Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg max-h-64 overflow-y-auto">
              {connectionLog.length === 0 ? (
                <p className="text-gray-500 text-sm">No log entries yet...</p>
              ) : (
                <div className="space-y-1">
                  {connectionLog.map((entry, index) => (
                    <div key={index} className="text-sm font-mono">
                      {entry}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Messages Log */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Messages Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg max-h-64 overflow-y-auto">
              {(!messages || messages.length === 0) ? (
                <p className="text-gray-500 text-sm">No messages yet...</p>
              ) : (
                <div className="space-y-2">
                  {messages.map((message, index) => (
                    <div key={index} className="text-sm">
                      <span className="font-medium">{message.senderName || 'Unknown'}:</span> {message.content}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
} 