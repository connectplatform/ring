'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import type { MessagePayload } from 'firebase/messaging'
import { app, getFcmVapidKey, isFcmConfigured, isKnownCrossProjectVapidLeak, validateFirebaseConfig } from '@/lib/firebase-client'
import { getOrCreateDeviceFingerprint } from '@/lib/notifications/device-fingerprint'

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

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

/**
 * RFC web-push subscribe — dedicated VAPID_* only.
 *
 * Browser PushManager allows **one** subscription per SW scope. FCM `getToken()`
 * already creates a subscription with the Firebase Console certificate; storing
 * that endpoint under `push_subscriptions` and signing with RFC private fails.
 * Only create+upsert an RFC subscription when no PushManager subscription exists
 * (Safari / FCM-unavailable paths). Chrome FCM continues via `fcm_tokens`.
 */
async function registerRfcWebPushSubscription(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
  if (!('Notification' in window) || Notification.permission !== 'granted') return

  try {
    const res = await fetch('/api/push/vapid-public')
    if (!res.ok) return
    const data = (await res.json()) as { configured?: boolean; publicKey?: string }
    if (!data.configured || !data.publicKey) return

    const registration =
      (await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js')) ||
      (await navigator.serviceWorker.ready)

    const existing = await registration.pushManager.getSubscription()
    if (existing) {
      // FCM (or another stack) already owns this scope — do not dual-bind.
      return
    }

    const applicationServerKey = urlBase64ToUint8Array(data.publicKey)
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as BufferSource,
    })

    const json = subscription.toJSON()
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return

    const deviceFingerprint = getOrCreateDeviceFingerprint()
    if (!deviceFingerprint) return

    const { upsertPushSubscription } = await import('@/app/_actions/push')
    await upsertPushSubscription({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      deviceFingerprint,
      expirationTime: json.expirationTime ?? null,
      platform: 'web',
      deviceInfo: {
        platform: 'web',
        userAgent: navigator.userAgent,
        lastSeen: new Date().toISOString(),
      },
    })
  } catch (err) {
    console.warn('RFC web-push subscribe skipped', err)
  }
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
        // Check if Firebase is properly configured (incl. VAPID for token subscribe)
        if (!isFcmConfigured()) {
          setState(prev => ({
            ...prev,
            isSupported: false,
            error: isKnownCrossProjectVapidLeak()
              ? `FCM VAPID key is from ring-main but NEXT_PUBLIC_FIREBASE_PROJECT_ID is ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}. Generate Web Push keys in Firebase Console for this project.`
              : validateFirebaseConfig()
                ? 'FCM VAPID key missing or invalid (NEXT_PUBLIC_FIREBASE_VAPID_KEY)'
                : 'Firebase configuration incomplete',
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

        // iOS Safari tab: PushManager often undefined until Home Screen PWA
        if (!('PushManager' in window)) {
          setState(prev => ({
            ...prev,
            isSupported: false,
            error: 'PushManager unavailable — on iOS, add to Home Screen (standalone)',
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
        if ('serviceWorker' in navigator && isFcmConfigured()) {
          try {
            // Check if service worker is already registered
            const existingRegistration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');

            if (!existingRegistration) {
              const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
                scope: '/',
                updateViaCache: 'none',
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
  }, [status, session?.user?.id, state.isSupported])

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
          if (!app) {
            setState(prev => ({
              ...prev,
              isLoading: false,
              error: 'Firebase app not initialized',
            }))
            fcmInitializationInProgress = false
            return
          }

          let messaging
          try {
            const { getMessaging, getToken } = await import('firebase/messaging')
            messaging = getMessaging(app)
            // Only get token if permission is already granted — Console cert only
            const vapidKey = getFcmVapidKey()
            if (!vapidKey) {
              setState(prev => ({ ...prev, isLoading: false }))
              fcmInitializationInProgress = false
              return
            }

            const currentToken = await getToken(messaging, { vapidKey })

            if (currentToken) {
              setState(prev => ({ ...prev, token: currentToken, isLoading: false }))
              
              // Register token with server
              await registerTokenWithServer(currentToken)
              void registerRfcWebPushSubscription()
            } else {
              console.log('No FCM token available')
              setState(prev => ({ ...prev, isLoading: false }))
              void registerRfcWebPushSubscription()
            }
          } catch (messagingError) {
            console.error('Error getting messaging instance:', messagingError)
            setState(prev => ({
              ...prev,
              isLoading: false,
              error: 'Failed to initialize messaging service',
            }))
            fcmInitializationInProgress = false
            return
          }

        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to initialize FCM'
          if (message.includes('token-subscribe-failed') || message.includes('authentication credential')) {
            const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'unknown'
            const leakHint = isKnownCrossProjectVapidLeak()
              ? ` VAPID appears to be ring-main key but project is ${projectId} — regenerate Web Push certificate in Firebase Console for ${projectId}.`
              : ''
            console.warn(
              `FCM token subscribe skipped — check NEXT_PUBLIC_FIREBASE_VAPID_KEY matches project ${projectId} and enable Cloud Messaging API:${leakHint}`,
              message,
            )
          } else {
            console.error('Error initializing FCM:', error)
          }
          setState(prev => ({
            ...prev,
            isLoading: false,
            error:
              process.env.NODE_ENV === 'development'
                ? 'FCM unavailable — verify VAPID key and Cloud Messaging API'
                : message,
          }))
        } finally {
          fcmInitializationInProgress = false
        }
      }

      initializeFCMToken()
    }
  }, [status, session?.user?.id, state.isSupported, state.permission])

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

      if (!app) return

      const vapidKey = getFcmVapidKey()
      if (!vapidKey) return

      const { getMessaging, getToken } = await import('firebase/messaging')
      const messaging = getMessaging(app)
      const newToken = await getToken(messaging, { vapidKey })

      if (newToken) {
        setState(prev => ({ ...prev, token: newToken, isLoading: false }))
        await registerTokenWithServer(newToken)
        void registerRfcWebPushSubscription()
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

      lastRegistrationTime = Date.now()

      const deviceFingerprint = getOrCreateDeviceFingerprint()
      if (!deviceFingerprint) {
        console.warn('FCM device fingerprint unavailable')
        return
      }

      const deviceInfo = {
        platform: 'web',
        browser: getBrowserInfo(),
        userAgent: navigator.userAgent,
        lastSeen: new Date().toISOString(),
      }

      // Prefer REST over Server Action — upsertFcmToken as a Server Action
      // revalidates the current RSC page and caused admin/security refresh storms.
      const response = await fetch('/api/notifications/fcm/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          deviceFingerprint,
          deviceInfo,
          platform: 'web',
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(
          (data as { error?: string }).error || 'Failed to register token with server',
        )
      }

      console.log('FCM token registered with server')
    } catch (error) {
      console.error('FCM token registration failed:', error)
    }
  }

  const onMessageReceived = (callback: (payload: MessagePayload) => void) => {
    if (!state.isSupported) {
      return () => {}
    }

    let unsub: (() => void) | undefined
    let cancelled = false

    void import('firebase/messaging')
      .then(({ getMessaging, onMessage }) => {
        if (cancelled || !app) return
        try {
          const messaging = getMessaging(app)
          unsub = onMessage(messaging, callback)
        } catch (error) {
          console.error('Error setting up message listener:', error)
        }
      })
      .catch((error) => {
        console.error('Error loading firebase/messaging:', error)
      })

    return () => {
      cancelled = true
      unsub?.()
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