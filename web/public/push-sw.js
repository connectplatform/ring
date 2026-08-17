/**
 * RFC Web Push service worker helpers / standalone worker.
 * FCM continues to use /firebase-messaging-sw.js (importScripts Firebase compat).
 * Clients may register this SW when FCM is unavailable; otherwise the FCM SW
 * remains primary and PushManager.subscribe uses that registration.
 *
 * Keep notificationclick deep-links aligned with firebase-messaging-sw.js.
 */

self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Ring Notification', body: event.data.text() }
  }

  const title = payload.title || payload.notification?.title || 'Ring Notification'
  const options = {
    body: payload.body || payload.notification?.body || 'You have a new notification',
    icon: payload.icon || '/icons/notification-icon.png',
    badge: payload.badge || '/icons/badge-icon.png',
    tag: payload.tag || (payload.data?.type === 'call_invite' ? `call_invite-${payload.data.callId || Date.now()}` : `ring-${Date.now()}`),
    data: payload.data || {},
    renotify: true,
    requireInteraction: payload.data?.type === 'call_invite',
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'dismiss') return

  const data = event.notification.data || {}
  const clickAction =
    data.clickAction ||
    data.url ||
    actionUrlByType(data.type) ||
    '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'navigate' in client) {
          client.focus()
          return client.navigate(clickAction)
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(clickAction)
      }
    }),
  )
})

function actionUrlByType(type) {
  const map = {
    chat: '/messages',
    call_invite: '/messages',
    game_request: '/games',
    opportunity: '/opportunities',
    news: '/news',
    entity: '/entities',
    admin: '/admin',
    notification: '/notifications',
  }
  return map[type] || '/notifications'
}
