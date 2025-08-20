'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from '@/components/providers/session-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { CheckCircle, XCircle, AlertCircle, Send, Bell, BellOff, Smartphone, Globe, Clock } from 'lucide-react'

interface FCMStatus {
  fcmConfigured: boolean
  tokenCount: number
  tokens: Array<{
    id: string
    platform: string
    browser: string
    lastSeen: Date
    createdAt: Date
  }>
  environment: {
    hasVapidKey: boolean
    hasProjectId: boolean
    hasClientEmail: boolean
    hasPrivateKey: boolean
  }
}

interface TestResult {
  success: boolean
  message: string
  stats?: {
    totalTokens: number
    successCount: number
    failureCount: number
    failedTokensRemoved: number
  }
}

export default function FCMTestPage() {
  const { data: session, status } = useSession()
  const [fcmStatus, setFCMStatus] = useState<FCMStatus | null>(null)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [customMessage, setCustomMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')

  // Check notification permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission)
    }
  }, [])

  // Load FCM status
  useEffect(() => {
    if (status === 'authenticated') {
      loadFCMStatus()
    }
  }, [status])

  const loadFCMStatus = async () => {
    try {
      const response = await fetch('/api/notifications/fcm/test')
      if (response.ok) {
        const data = await response.json()
        setFCMStatus(data)
      }
    } catch (error) {
      console.error('Error loading FCM status:', error)
    }
  }

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      setPermission(permission)
      
      if (permission === 'granted') {
        // Reload status to get updated token count
        setTimeout(loadFCMStatus, 1000)
      }
    }
  }

  const sendTestNotification = async () => {
    setIsLoading(true)
    setTestResult(null)

    try {
      const response = await fetch('/api/notifications/fcm/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: customMessage.trim() || undefined
        })
      })

      const result = await response.json()
      setTestResult(result)

      if (result.success) {
        // Reload status to get updated token count
        await loadFCMStatus()
      }

    } catch (error) {
      setTestResult({
        success: false,
        message: 'Failed to send test notification: ' + (error instanceof Error ? error.message : 'Unknown error')
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please sign in to test FCM functionality.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">FCM Test Dashboard</h1>
          <p className="text-muted-foreground">Test Firebase Cloud Messaging functionality</p>
        </div>

        {/* Permission Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Permission
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {permission === 'granted' ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : permission === 'denied' ? (
                  <XCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                )}
                <span className="capitalize">{permission}</span>
              </div>
              {permission !== 'granted' && (
                <Button onClick={requestNotificationPermission}>
                  Request Permission
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Environment Status */}
        {fcmStatus && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Environment Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2">
                  {fcmStatus.environment.hasVapidKey ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm">VAPID Key</span>
                </div>
                <div className="flex items-center gap-2">
                  {fcmStatus.environment.hasProjectId ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm">Project ID</span>
                </div>
                <div className="flex items-center gap-2">
                  {fcmStatus.environment.hasClientEmail ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm">Client Email</span>
                </div>
                <div className="flex items-center gap-2">
                  {fcmStatus.environment.hasPrivateKey ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm">Private Key</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Token Status */}
        {fcmStatus && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                FCM Tokens
                <Badge variant="secondary">{fcmStatus.tokenCount}</Badge>
              </CardTitle>
              <CardDescription>
                Active FCM tokens for your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              {fcmStatus.tokenCount === 0 ? (
                <p className="text-muted-foreground">No active FCM tokens found. Enable notifications to register a token.</p>
              ) : (
                <div className="space-y-2">
                  {fcmStatus.tokens.map((token) => (
                    <div key={token.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{token.browser} on {token.platform}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last seen: {new Date(token.lastSeen).toLocaleString()}
                        </div>
                      </div>
                      <Badge variant="outline">Active</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Test Notification */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Send Test Notification
            </CardTitle>
            <CardDescription>
              Send a test push notification to verify FCM is working
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="message">Custom Message (optional)</Label>
              <Textarea
                id="message"
                placeholder="Enter a custom message for the test notification..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={3}
              />
            </div>
            
            <Button 
              onClick={sendTestNotification}
              disabled={isLoading || permission !== 'granted' || (fcmStatus?.tokenCount || 0) === 0}
              className="w-full"
            >
              {isLoading ? 'Sending...' : 'Send Test Notification'}
            </Button>

            {permission !== 'granted' && (
              <Alert>
                <BellOff className="h-4 w-4" />
                <AlertDescription>
                  Notification permission is required to send test notifications.
                </AlertDescription>
              </Alert>
            )}

            {(fcmStatus?.tokenCount || 0) === 0 && permission === 'granted' && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No FCM tokens found. Please refresh the page and ensure notifications are enabled.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Test Results */}
        {testResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                Test Result
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className={testResult.success ? 'text-green-600' : 'text-red-600'}>
                  {testResult.message}
                </p>
                
                {testResult.stats && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 p-4 bg-muted rounded-lg">
                    <div className="text-center">
                      <div className="font-semibold">{testResult.stats.totalTokens}</div>
                      <div className="text-sm text-muted-foreground">Total Tokens</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-green-600">{testResult.stats.successCount}</div>
                      <div className="text-sm text-muted-foreground">Successful</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-red-600">{testResult.stats.failureCount}</div>
                      <div className="text-sm text-muted-foreground">Failed</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-yellow-600">{testResult.stats.failedTokensRemoved}</div>
                      <div className="text-sm text-muted-foreground">Cleaned Up</div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Testing Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Ensure notification permission is granted</li>
              <li>Verify all environment variables are configured</li>
              <li>Check that FCM tokens are registered</li>
              <li>Send a test notification</li>
              <li>Check browser notifications and console for any errors</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 