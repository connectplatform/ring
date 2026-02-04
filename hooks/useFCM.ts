'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { getMessaging, getToken, onMessage, MessagePayload } from 'firebase/messaging'
import { app, validateFirebaseConfig } from '@/lib/firebase-client'
import { apiClient, ApiClientError, type ApiResponse } from '@/lib/api-client'

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

// Track if FCM initialization is in progress to prevent duplicates
let fcmInitializationInProgress = false;
let lastRegistrationTime = 0;
const REGISTRATION_DEBOUNCE_MS = 5000; // 5 seconds debounce

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

  // Initialize FCM service worker when user is authenticated and Firebase is available
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id && state.isSupported) {
      const initializeFCMServiceWorker = async () => {
        // Only register service worker if Firebase is properly configured
        if ('serviceWorker' in navigator && validateFirebaseConfig()) {
          try {
            // Check if service worker is already registered
            const existingRegistration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');

            if (!existingRegistration) {
              const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
                scope: '/'
              });
              console.log('FCM Service Worker registered:', registration);
            } else {
              console.log('FCM Service Worker already registered:', existingRegistration);
            }
          } catch (swError) {
            console.warn('FCM Service Worker registration failed:', swError);
            // Continue without service worker for background notifications
          }
        } else {
          console.log('FCM Service Worker not registered - Firebase not configured');
        }
      }

      initializeFCMServiceWorker()
    }
  }, [status, session, state.isSupported])

  // Separate effect for checking existing permission (without requesting new permission)
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id && state.isSupported && state.permission === 'granted') {
      const initializeFCMToken = async () => {
        // Prevent duplicate initialization
        if (fcmInitializationInProgress) {
          console.log('FCM token initialization already in progress, skipping...')
          return
        }
        
        // Debounce registration to prevent rapid successive calls
        const now = Date.now()
        if (now - lastRegistrationTime < REGISTRATION_DEBOUNCE_MS) {
          console.log('FCM token registration debounced, too soon after last registration')
          return
        }
        
        fcmInitializationInProgress = true
        
        try {
          setState(prev => ({ ...prev, isLoading: true, error: null }))

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
            fcmInitializationInProgress = false
            return
          }

          // Only get token if permission is already granted
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
            error: process.env.NODE_ENV === 'development' ? 'FCM disabled in development' : (error instanceof Error ? error.message : 'Failed to initialize FCM')
          }))
        } finally {
          fcmInitializationInProgress = false
        }
      }

      initializeFCMToken()
    }
  }, [status, session, state.isSupported, state.permission])

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

      // Update last registration time
      lastRegistrationTime = Date.now()

      const deviceInfo = {
        platform: navigator.platform,
        browser: getBrowserInfo(),
        userAgent: navigator.userAgent,
        lastSeen: new Date()
      }

      // Use API client with notification domain configuration (8s timeout, 1 retry)
      const response: ApiResponse = await apiClient.post('/api/notifications/fcm/register', {
        token,
        deviceInfo
      }, {
        timeout: 8000, // 8 second timeout for notification operations
        retries: 1 // Retry once for transient failures
      })

      if (response.success) {
        console.log('FCM token registered with server')
      } else {
        throw new Error(response.error || 'Failed to register token with server')
      }
    } catch (error) {
      if (error instanceof ApiClientError) {
        console.error('FCM token registration failed:', {
          endpoint: '/api/notifications/fcm/register',
          statusCode: error.statusCode,
          message: error.message,
          context: error.context
        })
      } else {
        console.error('Unexpected error registering token with server:', error)
      }
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