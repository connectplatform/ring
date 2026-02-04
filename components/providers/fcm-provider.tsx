'use client'

import React, { createContext, use, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useFCM, useFCMMessages } from '@/hooks/useFCM'
import { toast } from '@/hooks/use-toast'

interface FCMContextType {
  isEnabled: boolean
  isSupported: boolean
  isLoading: boolean
  error: string | null
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

export function FCMProvider({ children }: FCMProviderProps) {
  const { data: session, status } = useSession()
  const {
    token,
    permission,
    isSupported,
    isLoading,
    error,
    requestPermission,
    onMessageReceived
  } = useFCM()
  const { messages, clearMessages } = useFCMMessages()
  
  const [tokenCount, setTokenCount] = useState(0)
  const isEnabled = permission === 'granted' && !!token

  // Handle incoming FCM messages
  useEffect(() => {
    if (messages.length > 0) {
      const latestMessage = messages[messages.length - 1]
      
      // Show toast notification for foreground messages
      if (latestMessage.notification) {
        toast({
          title: latestMessage.notification.title || 'New Notification',
          description: latestMessage.notification.body,
          duration: 5000,
        })
      }

      // Handle custom actions based on message data
      if (latestMessage.data) {
        handleMessageAction(latestMessage.data)
      }

      // Clear processed messages
      setTimeout(() => clearMessages(), 1000)
    }
  }, [messages, clearMessages])

  // Get token count for user
  useEffect(() => {
    if (session?.user?.id && isEnabled) {
      fetchTokenCount()
    }
  }, [session?.user?.id, isEnabled])

  const enableNotifications = async (): Promise<boolean> => {
    try {
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
      if (token) {
        // Remove token from server
        await fetch('/api/notifications/fcm/register', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token })
        })

        toast({
          title: 'Notifications Disabled',
          description: 'You will no longer receive push notifications.',
          duration: 3000,
        })

        setTokenCount(0)
      }
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

  const handleMessageAction = (data: Record<string, string>) => {
    // Handle different types of notification actions
    switch (data.type) {
      case 'chat':
        // Navigate to chat
        if (data.chatId) {
          window.location.href = `/chat/${data.chatId}`
        }
        break
        
      case 'opportunity':
        // Navigate to opportunity
        if (data.opportunityId) {
          window.location.href = `/opportunities/${data.opportunityId}`
        }
        break
        
      case 'news':
        // Navigate to news article
        if (data.newsId) {
          window.location.href = `/news/${data.newsId}`
        }
        break
        
      case 'entity':
        // Navigate to entity
        if (data.entityId) {
          window.location.href = `/entities/${data.entityId}`
        }
        break
        
      default:
        // Default action - navigate to notifications page
        if (data.clickAction) {
          window.location.href = data.clickAction
        } else {
          window.location.href = '/notifications'
        }
    }
  }

  const contextValue: FCMContextType = {
    isEnabled,
    isSupported,
    isLoading,
    error,
    enableNotifications,
    disableNotifications,
    tokenCount
  }

  return (
    <FCMContext.Provider value={contextValue}>
      {children}
    </FCMContext.Provider>
  )
}

// Notification permission prompt component
export function FCMPermissionPrompt() {
  const { isSupported, isEnabled, isLoading, enableNotifications } = useFCMContext()
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    // Show prompt after 3 seconds if notifications are supported but not enabled
    const timer = setTimeout(() => {
      if (isSupported && !isEnabled && !isLoading) {
        setShowPrompt(true)
      }
    }, 3000)

    return () => clearTimeout(timer)
  }, [isSupported, isEnabled, isLoading])

  if (!showPrompt || isEnabled || !isSupported) {
    return null
  }

  const handleEnable = async () => {
    const success = await enableNotifications()
    if (success) {
      setShowPrompt(false)
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    // Don't show again for this session
    sessionStorage.setItem('fcm-prompt-dismissed', 'true')
  }

  // Check if user has already dismissed the prompt
  if (typeof window !== 'undefined' && sessionStorage.getItem('fcm-prompt-dismissed')) {
    return null
  }

  return (
    <div className="fixed top-4 right-4 max-w-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 z-50">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2L3 9v9h4v-6h6v6h4V9l-7-7z"/>
            </svg>
          </div>
        </div>
        <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-foreground">
            Enable Push Notifications
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Get real-time updates about opportunities, messages, and important news.
          </p>
          <div className="mt-3 flex space-x-2">
            <button
              onClick={handleEnable}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Enable
            </button>
            <button
              onClick={handleDismiss}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded text-muted-foreground bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
          </svg>
        </button>
      </div>
    </div>
  )
} 