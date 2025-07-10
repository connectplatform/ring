'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { getMessaging, getToken, onMessage, MessagePayload } from 'firebase/messaging'
import { app, validateFirebaseConfig } from '@/lib/firebase-client'

interface FCMState {
  token: string | null
  permission: NotificationPermission
  isSupported: boolean
  isLoading: boolean
  error: string | null
}

interface FCMHookReturn extends FCMState {
  requestPermission: () => Promise<boolean>
  refreshToken: () => Promise<void>
  onMessageReceived: (callback: (payload: MessagePayload) => void) => () => void
}

export function useFCM(): FCMHookReturn {
  const { data: session, status } = useSession()
  const [state, setState] = useState<FCMState>({
    token: null,
    permission: 'default',
    isSupported: false,
    isLoading: false,
    error: null
  })

  // Check if FCM is supported
  useEffect(() => {
    const checkSupport = async () => {
      try {
        // Check if Firebase is properly configured
        if (!validateFirebaseConfig()) {
          setState(prev => ({ 
            ...prev, 
            isSupported: false,
            error: 'Firebase configuration incomplete' 
          }))
          return
        }

        // Check if browser supports notifications
        if (!('Notification' in window)) {
          setState(prev => ({ 
            ...prev, 
            isSupported: false,
            error: 'Browser does not support notifications' 
          }))
          return
        }

        // Check if service worker is supported
        if (!('serviceWorker' in navigator)) {
          setState(prev => ({ 
            ...prev, 
            isSupported: false,
            error: 'Service workers not supported' 
          }))
          return
        }

        // Check if Firebase messaging is available
        if (!app) {
          setState(prev => ({ 
            ...prev, 
            isSupported: false,
            error: 'Firebase app not initialized' 
          }))
          return
        }

        setState(prev => ({ 
          ...prev, 
          isSupported: true,
          permission: Notification.permission,
          error: null 
        }))
      } catch (error) {
        console.error('Error checking FCM support:', error)
        setState(prev => ({ 
          ...prev, 
          isSupported: false,
          error: error instanceof Error ? error.message : 'Failed to check FCM support'
        }))
      }
    }

    checkSupport()
  }, [])

  // Initialize FCM token when user is authenticated
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id && state.isSupported) {
      const initializeFCM = async () => {
        try {
          setState(prev => ({ ...prev, isLoading: true, error: null }))

          // Register service worker
          if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
            console.log('Service Worker registered:', registration)
          }

          // Get messaging instance with error handling
          let messaging;
          try {
            messaging = getMessaging(app)
          } catch (messagingError) {
            console.error('Error getting messaging instance:', messagingError)
            setState(prev => ({ 
              ...prev, 
              isLoading: false,
              error: 'Failed to initialize messaging service' 
            }))
            return
          }

          // Get existing token
          const currentToken = await getToken(messaging, {
            vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
          })

          if (currentToken) {
            setState(prev => ({ ...prev, token: currentToken, isLoading: false }))
            
            // Register token with server
            await registerTokenWithServer(currentToken)
          } else {
            console.log('No FCM token available')
            setState(prev => ({ ...prev, isLoading: false }))
          }

        } catch (error) {
          console.error('Error initializing FCM:', error)
          setState(prev => ({ 
            ...prev, 
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to initialize FCM'
          }))
        }
      }

      initializeFCM()
    }
  }, [status, session, state.isSupported])

  const requestPermission = async (): Promise<boolean> => {
    try {
      if (!state.isSupported) {
        throw new Error('FCM not supported')
      }

      const permission = await Notification.requestPermission()
      setState(prev => ({ ...prev, permission }))

      if (permission === 'granted') {
        await refreshToken()
        return true
      }

      return false
    } catch (error) {
      console.error('Error requesting permission:', error)
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to request permission'
      }))
      return false
    }
  }

  const refreshToken = async (): Promise<void> => {
    try {
      if (!state.isSupported || state.permission !== 'granted') {
        return
      }

      setState(prev => ({ ...prev, isLoading: true, error: null }))

      const messaging = getMessaging(app)
      const newToken = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
      })

      if (newToken) {
        setState(prev => ({ ...prev, token: newToken, isLoading: false }))
        await registerTokenWithServer(newToken)
      } else {
        setState(prev => ({ ...prev, isLoading: false }))
      }

    } catch (error) {
      console.error('Error refreshing token:', error)
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to refresh token'
      }))
    }
  }

  const registerTokenWithServer = async (token: string): Promise<void> => {
    try {
      if (!session?.user?.id) return

      const deviceInfo = {
        platform: navigator.platform,
        browser: getBrowserInfo(),
        userAgent: navigator.userAgent,
        lastSeen: new Date()
      }

      const response = await fetch('/api/notifications/fcm/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          deviceInfo
        })
      })

      if (!response.ok) {
        throw new Error('Failed to register token with server')
      }

      console.log('FCM token registered with server')
    } catch (error) {
      console.error('Error registering token with server:', error)
    }
  }

  const onMessageReceived = (callback: (payload: MessagePayload) => void) => {
    if (!state.isSupported) {
      return () => {}
    }

    try {
      const messaging = getMessaging(app)
      return onMessage(messaging, callback)
    } catch (error) {
      console.error('Error setting up message listener:', error)
      return () => {}
    }
  }

  const getBrowserInfo = (): string => {
    const userAgent = navigator.userAgent
    
    if (userAgent.includes('Chrome')) return 'Chrome'
    if (userAgent.includes('Firefox')) return 'Firefox'
    if (userAgent.includes('Safari')) return 'Safari'
    if (userAgent.includes('Edge')) return 'Edge'
    if (userAgent.includes('Opera')) return 'Opera'
    
    return 'Unknown'
  }

  return {
    ...state,
    requestPermission,
    refreshToken,
    onMessageReceived
  }
}

// Utility hook for handling FCM messages
export function useFCMMessages() {
  const [messages, setMessages] = useState<MessagePayload[]>([])
  const { onMessageReceived, isSupported } = useFCM()

  useEffect(() => {
    if (!isSupported) return

    const unsubscribe = onMessageReceived((payload) => {
      console.log('FCM message received:', payload)
      setMessages(prev => [...prev, payload])

      // Show browser notification if supported
      if (payload.notification) {
        new Notification(payload.notification.title || 'New notification', {
          body: payload.notification.body,
          icon: payload.notification.icon || '/icons/notification-icon.png',
          badge: '/icons/badge-icon.png',
          tag: payload.data?.tag || 'default',
          requireInteraction: true
        })
      }
    })

    return unsubscribe
  }, [isSupported, onMessageReceived])

  const clearMessages = () => setMessages([])

  return {
    messages,
    clearMessages
  }
} 