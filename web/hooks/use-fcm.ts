'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import type { MessagePayload } from 'firebase/messaging'
import { getFcmVapidKey, getFirebaseClientApp, isFcmConfigured } from '@/lib/firebase-client'
import { getOrCreateDeviceFingerprint } from '@/lib/notifications/device-fingerprint'
import { isRfcWebPushConfigured } from '@/lib/notifications/rfc-webpush-probe'
import { needsIosHomeScreenForPush } from '@/lib/browser/pwa-display'
import { isPushOptedOut } from '@/lib/notifications/push-opt-out'
import {
  getBrowserNotificationPermission,
  isBrowserNotificationSupported,
  requestBrowserNotificationPermission,
} from '@/lib/browser/notification-api'

interface FCMState {
  token: string | null
  permission: NotificationPermission
  isSupported: boolean
  isLoading: boolean
  error: string | null
  rfcSubscribed: boolean
  needsHomeScreenInstall: boolean
}

interface FCMHookReturn extends FCMState {
  requestPermission: () => Promise<boolean>
  refreshToken: () => Promise<void>
  resetLocalPushState: () => void
  onMessageReceived: (callback: (payload: MessagePayload) => void) => () => void
}

async function subscribeWithVapid(): Promise<string | null> {
  const vapidKey = getFcmVapidKey()
  const firebaseApp = getFirebaseClientApp()
  if (!firebaseApp || !vapidKey) return null
  const { getMessaging, getToken } = await import('firebase/messaging')
  const registration =
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator
      ? await navigator.serviceWorker.getRegistration().catch(() => undefined)
      : undefined
  return getToken(getMessaging(firebaseApp), {
    vapidKey,
    ...(registration ? { serviceWorkerRegistration: registration } : {}),
  })
}

let fcmInitializationInProgress = false
let lastRegistrationTime = 0
const REGISTRATION_DEBOUNCE_MS = 5000

import { FCM_SW_URL, RFC_SW_URL, registerAppShellServiceWorker } from '@/lib/notifications/register-app-shell-sw'

function applicationServerKeysMatch(existing: ArrayBuffer | null, publicKey: string): boolean {
  if (!existing) return false
  const current = new Uint8Array(existing)
  const next = urlBase64ToUint8Array(publicKey)
  if (current.length !== next.length) return false
  for (let i = 0; i < current.length; i += 1) {
    if (current[i] !== next[i]) return false
  }
  return true
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

async function getPushRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined
  return (
    (await navigator.serviceWorker.getRegistration(FCM_SW_URL)) ||
    (await navigator.serviceWorker.getRegistration(RFC_SW_URL)) ||
    (await navigator.serviceWorker.ready)
  )
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
async function registerRfcWebPushSubscription(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  if (!isBrowserNotificationSupported() || Notification.permission !== 'granted') {
    return false
  }

  try {
    const res = await fetch('/api/push/vapid-public')
    if (!res.ok) return false
    const data = (await res.json()) as { configured?: boolean; publicKey?: string }
    if (!data.configured || !data.publicKey) return false

    const registration = await getPushRegistration()
    if (!registration) return false

    const existing = await registration.pushManager.getSubscription()
    if (existing) {
      if (isFcmConfigured()) {
        // Chrome FCM owns this PushManager subscription. Do not replace it.
        return false
      }
      const sameKey = applicationServerKeysMatch(
        existing.options?.applicationServerKey ?? null,
        data.publicKey,
      )
      if (sameKey) return false
      await existing.unsubscribe()
    }

    const applicationServerKey = urlBase64ToUint8Array(data.publicKey)
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as BufferSource,
    })

    const json = subscription.toJSON()
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false

    const deviceFingerprint = getOrCreateDeviceFingerprint()
    if (!deviceFingerprint) return false

    const { upsertPushSubscription } = await import('@/app/_actions/push')
    const result = await upsertPushSubscription({
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
    return !('error' in result)
  } catch (err) {
    console.warn('RFC web-push subscribe skipped', err)
    return false
  }
}

async function registerPushServiceWorker(fcmUsable: boolean): Promise<void> {
  if (!('serviceWorker' in navigator)) return

  if (fcmUsable) {
    try {
      const existing = await navigator.serviceWorker.getRegistration(FCM_SW_URL)
      if (!existing) {
        await navigator.serviceWorker.register(FCM_SW_URL, {
          scope: '/',
          updateViaCache: 'none',
        })
      }
    } catch (swError) {
      console.warn('FCM Service Worker registration failed:', swError)
    }
    return
  }

  try {
    await registerAppShellServiceWorker()
  } catch (swError) {
    console.warn('RFC Service Worker registration failed:', swError)
  }
}

export function useFCM(): FCMHookReturn {
  const { data: session, status } = useSession()
  const [state, setState] = useState<FCMState>({
    token: null,
    permission: 'default',
    isSupported: false,
    isLoading: false,
    error: null,
    rfcSubscribed: false,
    needsHomeScreenInstall: false,
  })

  useEffect(() => {
    const checkSupport = async () => {
      try {
        if (needsIosHomeScreenForPush()) {
          setState((prev) => ({
            ...prev,
            isSupported: false,
            needsHomeScreenInstall: true,
            error: 'PushManager unavailable — on iOS, add to Home Screen (standalone)',
          }))
          return
        }

        if (!isBrowserNotificationSupported()) {
          setState((prev) => ({
            ...prev,
            isSupported: false,
            needsHomeScreenInstall: false,
            error: 'Browser does not support notifications',
          }))
          return
        }

        if (!('serviceWorker' in navigator)) {
          setState((prev) => ({
            ...prev,
            isSupported: false,
            needsHomeScreenInstall: false,
            error: 'Service workers not supported',
          }))
          return
        }

        if (!('PushManager' in window)) {
          setState((prev) => ({
            ...prev,
            isSupported: false,
            needsHomeScreenInstall: needsIosHomeScreenForPush(),
            error: 'PushManager unavailable — on iOS, add to Home Screen (standalone)',
          }))
          return
        }

        const fcmUsable = isFcmConfigured() && Boolean(getFirebaseClientApp())
        const rfcUsable = await isRfcWebPushConfigured()

        if (!fcmUsable && !rfcUsable) {
          setState((prev) => ({
            ...prev,
            isSupported: false,
            needsHomeScreenInstall: false,
            permission: getBrowserNotificationPermission(),
            error: fcmUsable
              ? null
              : 'Push not configured (Firebase FCM or VAPID_* RFC)',
          }))
          return
        }

        setState((prev) => ({
          ...prev,
          isSupported: true,
          needsHomeScreenInstall: false,
          permission: getBrowserNotificationPermission(),
          error: null,
        }))
      } catch (error) {
        console.error('Error checking push support:', error)
        setState((prev) => ({
          ...prev,
          isSupported: false,
          error: error instanceof Error ? error.message : 'Failed to check push support',
        }))
      }
    }

    void checkSupport()
  }, [])

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id || !state.isSupported) {
      return
    }
    const fcmUsable = isFcmConfigured() && Boolean(getFirebaseClientApp())
    void registerPushServiceWorker(fcmUsable)
  }, [status, session?.user?.id, state.isSupported])

  useEffect(() => {
    if (
      status !== 'authenticated' ||
      !session?.user?.id ||
      !state.isSupported ||
      state.permission !== 'granted'
    ) {
      return
    }
    if (isPushOptedOut()) {
      return
    }

    const initializePush = async () => {
      if (fcmInitializationInProgress) return

      const now = Date.now()
      if (now - lastRegistrationTime < REGISTRATION_DEBOUNCE_MS) return

      fcmInitializationInProgress = true

      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }))

        let currentToken: string | null = null
        if (isFcmConfigured() && getFirebaseClientApp()) {
          try {
            currentToken = await subscribeWithVapid()
            if (currentToken) {
              await registerTokenWithServer(currentToken)
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to initialize FCM'
            const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'unknown'
            if (
              message.includes('token-subscribe-failed') ||
              message.includes('authentication credential')
            ) {
              console.warn(
                `FCM token subscribe skipped — check NEXT_PUBLIC_FIREBASE_VAPID_KEY matches project ${projectId} and enable Cloud Messaging API`,
                message,
              )
            } else {
              console.error('Error initializing FCM:', error)
            }
            setState((prev) => ({
              ...prev,
              error:
                process.env.NODE_ENV === 'development'
                  ? `${message} (project ${projectId})`
                  : message,
            }))
          }
        }

        const rfcOk = await registerRfcWebPushSubscription()
        setState((prev) => ({
          ...prev,
          token: currentToken,
          rfcSubscribed: rfcOk || prev.rfcSubscribed,
          isLoading: false,
        }))
      } finally {
        fcmInitializationInProgress = false
      }
    }

    void initializePush()
  }, [status, session?.user?.id, state.isSupported, state.permission])

  const requestPermission = async (): Promise<boolean> => {
    try {
      if (!state.isSupported) {
        throw new Error('Push notifications not supported in this browser')
      }

      const permission = await requestBrowserNotificationPermission()
      setState((prev) => ({ ...prev, permission }))

      if (permission === 'granted') {
        await refreshToken()
        return true
      }

      return false
    } catch (error) {
      console.error('Error requesting permission:', error)
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to request permission',
      }))
      return false
    }
  }

  const refreshToken = async (): Promise<void> => {
    try {
      if (isPushOptedOut()) return
      if (!state.isSupported || getBrowserNotificationPermission() !== 'granted') {
        return
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null, permission: 'granted' }))

      let newToken: string | null = null
      if (isFcmConfigured() && getFirebaseClientApp()) {
        newToken = await subscribeWithVapid()
        if (newToken) {
          await registerTokenWithServer(newToken)
        }
      }

      const rfcOk = await registerRfcWebPushSubscription()
      setState((prev) => ({
        ...prev,
        token: newToken,
        rfcSubscribed: rfcOk || prev.rfcSubscribed,
        isLoading: false,
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refresh token'
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'unknown'
      console.error('Error refreshing token:', error)
      const rfcOk = isPushOptedOut() ? false : await registerRfcWebPushSubscription()
      setState((prev) => ({
        ...prev,
        isLoading: false,
        rfcSubscribed: rfcOk || prev.rfcSubscribed,
        error:
          process.env.NODE_ENV === 'development'
            ? `${message} (project ${projectId})`
            : message,
      }))
    }
  }

  const registerTokenWithServer = async (token: string): Promise<void> => {
    try {
      if (!session?.user?.id) return

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

      const { upsertFcmToken } = await import('@/app/_actions/fcm')
      const result = await upsertFcmToken({
        token,
        deviceFingerprint,
        deviceInfo,
        platform: 'web',
      })
      if ('error' in result) {
        throw new Error(result.error)
      }
      lastRegistrationTime = Date.now()
    } catch (error) {
      console.error('FCM token registration failed:', error)
    }
  }

  const resetLocalPushState = useCallback(() => {
    setState((prev) => ({
      ...prev,
      token: null,
      rfcSubscribed: false,
      isLoading: false,
    }))
  }, [])

  const fcmForegroundReady = state.isSupported && isFcmConfigured() && Boolean(getFirebaseClientApp())

  const onMessageReceived = useCallback(
    (callback: (payload: MessagePayload) => void) => {
      if (!fcmForegroundReady) {
        return () => {}
      }

      let unsub: (() => void) | undefined
      let cancelled = false

      void import('firebase/messaging')
        .then(({ getMessaging, onMessage }) => {
          const firebaseApp = getFirebaseClientApp()
          if (cancelled || !firebaseApp) return
          try {
            unsub = onMessage(getMessaging(firebaseApp), callback)
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
    },
    [fcmForegroundReady],
  )

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
    resetLocalPushState,
    onMessageReceived,
  }
}

/** Foreground FCM inbox only — never constructs Notification (toast/banner live in FCMProvider). */
export function useFCMMessages(
  onMessageReceived: FCMHookReturn['onMessageReceived'],
  isSupported: boolean,
) {
  const [messages, setMessages] = useState<MessagePayload[]>([])

  useEffect(() => {
    if (!isSupported) return

    const unsubscribe = onMessageReceived((payload) => {
      setMessages((prev) => [...prev, payload])
    })

    return unsubscribe
  }, [isSupported, onMessageReceived])

  const clearMessages = () => setMessages([])

  return {
    messages,
    clearMessages,
  }
}
