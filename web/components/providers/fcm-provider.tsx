'use client'

import React, { createContext, use, useCallback, useEffect, useState, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useFCM, useFCMMessages } from '@/hooks/use-fcm'
import { unregisterCurrentDevicePush } from '@/lib/notifications/fcm-client-cleanup'
import { setPushOptedOut } from '@/lib/notifications/push-opt-out'
import { getBrowserNotificationPermission } from '@/lib/browser/notification-api'
import { emitInteractivePushFromFcmData } from '@/lib/notifications/incoming-from-push'
import { isFcmConfigured } from '@/lib/firebase-client'
import { toast } from '@/hooks/use-toast'

interface FCMContextType {
  isEnabled: boolean
  isSupported: boolean
  isLoading: boolean
  error: string | null
  needsHomeScreenInstall: boolean
  enableNotifications: () => Promise<boolean>
  disableNotifications: () => Promise<void>
  tokenCount: number
}

const FCMContext = createContext<FCMContextType | undefined>(undefined)

/**
 * Modern React 19 hook to access FCM context
 * Uses the use() hook for better performance and conditional access
 */
export function useFCMContext() {
  const context = use(FCMContext)
  if (context === undefined) {
    throw new Error('useFCMContext must be used within a FCMProvider')
  }
  return context
}

interface FCMProviderProps {
  children: React.ReactNode
}

const FCM_DISCONNECTED_CONTEXT: FCMContextType = {
  isEnabled: false,
  isSupported: false,
  isLoading: false,
  error: null,
  needsHomeScreenInstall: false,
  enableNotifications: async () => false,
  disableNotifications: async () => {},
  tokenCount: 0,
}

export function FCMProvider({ children }: FCMProviderProps) {
  return (
    <Suspense
      fallback={
        <FCMContext.Provider value={FCM_DISCONNECTED_CONTEXT}>{children}</FCMContext.Provider>
      }
    >
      <FCMProviderRuntime>{children}</FCMProviderRuntime>
    </Suspense>
  )
}

function FCMProviderRuntime({ children }: FCMProviderProps) {
  const { data: session } = useSession()
  const {
    token,
    permission,
    isSupported,
    isLoading,
    error,
    rfcSubscribed,
    needsHomeScreenInstall,
    requestPermission,
    resetLocalPushState,
    onMessageReceived,
  } = useFCM()
  const fcmForeground = isSupported && isFcmConfigured()
  const { messages, clearMessages } = useFCMMessages(onMessageReceived, fcmForeground)

  const [tokenCount, setTokenCount] = useState(0)
  const isEnabled =
    permission === 'granted' && (!!token || rfcSubscribed)

  const handleMessageAction = useCallback((data: Record<string, string>) => {
    switch (data.type) {
      case 'call_invite':
      case 'game_request':
        return
      case 'chat':
        if (data.chatId) {
          window.location.href = `/chat/${data.chatId}`
        }
        break
      case 'opportunity':
        if (data.opportunityId) {
          window.location.href = `/opportunities/${data.opportunityId}`
        }
        break
      case 'news':
        if (data.newsId) {
          window.location.href = `/news/${data.newsId}`
        }
        break
      case 'entity':
        if (data.entityId) {
          window.location.href = `/entities/${data.entityId}`
        }
        break
      default:
        if (data.clickAction) {
          window.location.href = data.clickAction
        }
        break
    }
  }, [])

  useEffect(() => {
    if (messages.length === 0) return
    const latestMessage = messages[messages.length - 1]
    const data = (latestMessage.data || {}) as Record<string, string>
    const interactive = emitInteractivePushFromFcmData(data, session?.user?.id || '')

    if (!interactive && latestMessage.notification) {
      toast({
        title: latestMessage.notification.title || 'New Notification',
        description: latestMessage.notification.body,
        duration: 5000,
      })
    }

    if (!interactive && latestMessage.data) {
      handleMessageAction(data)
    }

    const timer = window.setTimeout(() => clearMessages(), 1000)
    return () => window.clearTimeout(timer)
  }, [messages, clearMessages, handleMessageAction, session?.user?.id])

  useEffect(() => {
    if (session?.user?.id && isEnabled) {
      void fetchTokenCount()
    }
  }, [session?.user?.id, isEnabled])

  const enableNotifications = async (): Promise<boolean> => {
    try {
      setPushOptedOut(false)
      const granted = await requestPermission()
      if (granted) {
        toast({
          title: 'Notifications Enabled',
          description: 'You will now receive push notifications for important updates.',
          duration: 3000,
        })
        await fetchTokenCount()
      }
      return granted
    } catch (error) {
      console.error('Error enabling notifications:', error)
      toast({
        title: 'Error',
        description: 'Failed to enable notifications. Please try again.',
        variant: 'destructive',
        duration: 5000,
      })
      return false
    }
  }

  const disableNotifications = async (): Promise<void> => {
    try {
      setPushOptedOut(true)
      await unregisterCurrentDevicePush()
      resetLocalPushState()

      toast({
        title: 'Notifications Disabled',
        description: 'You will no longer receive push notifications.',
        duration: 3000,
      })

      setTokenCount(0)
    } catch (error) {
      console.error('Error disabling notifications:', error)
      toast({
        title: 'Error',
        description: 'Failed to disable notifications. Please try again.',
        variant: 'destructive',
        duration: 5000,
      })
    }
  }

  const fetchTokenCount = async () => {
    try {
      const response = await fetch('/api/notifications/fcm/tokens/count')
      if (response.ok) {
        const data = await response.json()
        setTokenCount(data.count || 0)
      }
    } catch (error) {
      console.error('Error fetching token count:', error)
    }
  }

  const contextValue: FCMContextType = {
    isEnabled,
    isSupported,
    isLoading,
    error,
    needsHomeScreenInstall,
    enableNotifications,
    disableNotifications,
    tokenCount,
  }

  return (
    <FCMContext.Provider value={contextValue}>
      {children}
    </FCMContext.Provider>
  )
}

const FCM_PROMPT_STORAGE_KEY = 'fcm-prompt-dismissed'
const FCM_INSTALL_PROMPT_STORAGE_KEY = 'fcm-install-prompt-dismissed'

function getPromptDismissed(key: string): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(key) === 'true'
}

export function FCMPermissionPrompt() {
  const {
    isSupported,
    isEnabled,
    isLoading,
    needsHomeScreenInstall,
    enableNotifications,
  } = useFCMContext()
  const [showPrompt, setShowPrompt] = useState(false)

  const dismissKey = needsHomeScreenInstall
    ? FCM_INSTALL_PROMPT_STORAGE_KEY
    : FCM_PROMPT_STORAGE_KEY

  useEffect(() => {
    if (getPromptDismissed(dismissKey)) return
    if (!needsHomeScreenInstall && getBrowserNotificationPermission() === 'granted') return
    const timer = setTimeout(() => {
      if (getPromptDismissed(dismissKey)) return
      if (needsHomeScreenInstall || (isSupported && !isEnabled && !isLoading)) {
        setShowPrompt(true)
      }
    }, 3000)

    return () => clearTimeout(timer)
  }, [isSupported, isEnabled, isLoading, needsHomeScreenInstall, dismissKey])

  if (typeof window !== 'undefined' && getPromptDismissed(dismissKey)) {
    return null
  }

  if (!showPrompt) return null
  if (isEnabled) return null
  if (!needsHomeScreenInstall && !isSupported) return null

  const handleEnable = async () => {
    const success = await enableNotifications()
    if (success) {
      setShowPrompt(false)
      sessionStorage.setItem(FCM_PROMPT_STORAGE_KEY, 'true')
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    sessionStorage.setItem(dismissKey, 'true')
  }

  return (
    <div className="fixed top-4 right-4 max-w-sm bg-popover text-popover-foreground border border-border rounded-lg shadow-lg p-4 z-50">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2L3 9v9h4v-6h6v6h4V9l-7-7z"/>
            </svg>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-foreground">
            {needsHomeScreenInstall ? 'Install for notifications' : 'Enable Push Notifications'}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {needsHomeScreenInstall
              ? 'iPhone and iPad only allow push from a Home Screen web app (iOS 16.4+).'
              : 'Get real-time updates about opportunities, messages, and important news.'}
          </p>
          {needsHomeScreenInstall && (
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
              <li>Tap the Share button in Safari</li>
              <li>Choose Add to Home Screen</li>
              <li>Open the new icon, then tap Enable</li>
            </ol>
          )}
          <div className="mt-3 flex space-x-2">
            {!needsHomeScreenInstall && (
              <button
                onClick={() => void handleEnable()}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                Enable
              </button>
            )}
            <button
              onClick={handleDismiss}
              className="inline-flex items-center px-3 py-1.5 border border-border text-xs font-medium rounded-md text-foreground bg-background hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {needsHomeScreenInstall ? 'Got it' : 'Not now'}
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
