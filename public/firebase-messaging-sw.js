// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js')

// Firebase configuration - conditionally initialized based on environment
// In hybrid mode, Firebase config may be injected at runtime via environment variables
const getFirebaseConfig = () => {
  // Try to get config from environment variables first (runtime injection)
  const envConfig = {
    apiKey: self.FIREBASE_API_KEY,
    authDomain: self.FIREBASE_AUTH_DOMAIN,
    projectId: self.FIREBASE_PROJECT_ID,
    storageBucket: self.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: self.FIREBASE_MESSAGING_SENDER_ID,
    appId: self.FIREBASE_APP_ID,
    measurementId: self.FIREBASE_MEASUREMENT_ID
  };

  // Check if we have valid config from environment
  const hasValidEnvConfig = envConfig.apiKey && envConfig.projectId && envConfig.appId;

  if (hasValidEnvConfig) {
    console.log('FCM SW: Using runtime-injected Firebase config');
    return envConfig;
  }

  // Fallback to build-time config (may be placeholder values)
  const buildConfig = {
    apiKey: "AIzaSyCWd2YVU7mN0FkMMO9ZDuIv6MlnunH7VX8",
    authDomain: "ring-main.firebaseapp.com",
    projectId: "ring-main",
    storageBucket: "ring-main.appspot.com",
    messagingSenderId: "919637187324",
    appId: "1:919637187324:web:af95cb1c3d96f2bc0bd579",
    measurementId: "G-WVDVCRX12R"
  };

  console.log('FCM SW: Using build-time Firebase config (may be placeholder)');
  return buildConfig;
};

// Initialize Firebase conditionally
let messaging = null;
try {
  const firebaseConfig = getFirebaseConfig();
  firebase.initializeApp(firebaseConfig);
  messaging = firebase.messaging();
  console.log('FCM SW: Firebase initialized successfully');
} catch (error) {
  console.warn('FCM SW: Firebase initialization failed:', error);
  // Service worker will still register but FCM features won't work
}

// Enhanced background message handler with React 19 features
if (messaging) {
  messaging.onBackgroundMessage((payload) => {
  console.log('Background message received:', payload)

  const notificationTitle = payload.notification?.title || 'Ring Notification'
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: payload.notification?.icon || '/icons/notification-icon.png',
    badge: '/icons/badge-icon.png',
    data: payload.data || {},
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/icons/view-icon.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icons/dismiss-icon.png'
      }
    ],
    requireInteraction: payload.data?.priority === 'high' || payload.data?.priority === 'urgent',
    silent: false,
    tag: payload.data?.tag || payload.data?.type || 'default',
    // React 19 Enhanced: Better timestamp handling
    timestamp: Date.now(),
    // Enhanced visual options
    image: payload.notification?.image,
    dir: 'auto',
    lang: payload.data?.lang || 'en',
    renotify: payload.data?.renotify === 'true',
    vibrate: payload.data?.priority === 'urgent' ? [200, 100, 200] : [100]
  }

  // Show notification with enhanced options
  return self.registration.showNotification(notificationTitle, notificationOptions)
})
}

// Enhanced notification click handler with React 19 navigation
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event)

  event.notification.close()

  if (event.action === 'dismiss') {
    return
  }

  // Enhanced click action handling
  const clickAction = event.notification.data?.clickAction || 
                     event.notification.data?.url || 
                     getActionUrlByType(event.notification.data?.type) ||
                     '/'
  
  event.waitUntil(
    clients.matchAll({ 
      type: 'window', 
      includeUncontrolled: true 
    }).then((clientList) => {
        // Enhanced window matching logic
        for (const client of clientList) {
          // Check for exact URL match or same origin
          if (client.url === clickAction && 'focus' in client) {
            return client.focus()
          }
          
          // If we have a Ring app window open, navigate to the action
          if (client.url.includes(self.location.origin) && 'navigate' in client) {
            client.focus()
            return client.navigate(clickAction)
          }
        }

        // Open new window if no suitable client found
        if (clients.openWindow) {
          return clients.openWindow(clickAction)
        }
      })
  )

  // Track notification engagement
  trackNotificationEngagement(event.notification, 'click', event.action)
})

// Enhanced notification close handler
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event)
  
  // Track notification dismissal
  trackNotificationEngagement(event.notification, 'dismiss')
  
  // Optional: Send dismissal analytics to server
  if (event.notification.data?.trackDismissal) {
    event.waitUntil(
      fetch('/api/notifications/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'dismiss',
          notificationId: event.notification.data.notificationId,
          timestamp: Date.now(),
          type: event.notification.data.type
        })
      }).catch(error => {
        console.error('Error tracking notification dismissal:', error)
      })
    )
  }
})

// Enhanced push event handler with custom notification types
self.addEventListener('push', (event) => {
  if (!event.data) return

  console.log('Push event received:', event.data.text())
  
  try {
    const payload = event.data.json()
    
    // Custom handling for different notification types
    const notificationPromise = handleNotificationByType(payload)
    
    if (notificationPromise) {
      event.waitUntil(notificationPromise)
    }
    
  } catch (error) {
    console.error('Error handling push event:', error)
    
    // Fallback notification
    event.waitUntil(
      self.registration.showNotification('Ring Notification', {
        body: 'You have a new notification',
        icon: '/icons/notification-icon.png',
        tag: 'fallback'
      })
    )
  }
})

// Helper function to handle different notification types
function handleNotificationByType(payload) {
  const { type, data } = payload
  
  switch (type) {
    case 'chat':
      return showChatNotification(payload)
    case 'opportunity':
      return showOpportunityNotification(payload)
    case 'news':
      return showNewsNotification(payload)
    case 'entity':
      return showEntityNotification(payload)
    case 'admin':
      return showAdminNotification(payload)
    default:
      return showDefaultNotification(payload)
  }
}

// Enhanced notification handlers for different types
function showChatNotification(payload) {
  const options = {
    body: `New message from ${payload.senderName}`,
    icon: '/icons/chat-icon.png',
    badge: '/icons/badge-icon.png',
    data: payload,
    actions: [
      { action: 'reply', title: 'Reply', icon: '/icons/reply-icon.png' },
      { action: 'view', title: 'View Chat', icon: '/icons/view-icon.png' }
    ],
    requireInteraction: true,
    tag: `chat-${payload.chatId}`,
    vibrate: [100, 50, 100]
  }
  
  return self.registration.showNotification('New Message', options)
}

function showOpportunityNotification(payload) {
  const options = {
    body: payload.message || 'New opportunity available',
    icon: '/icons/opportunity-icon.png',
    badge: '/icons/badge-icon.png',
    data: payload,
    actions: [
      { action: 'view', title: 'View Opportunity', icon: '/icons/view-icon.png' },
      { action: 'apply', title: 'Apply Now', icon: '/icons/apply-icon.png' }
    ],
    requireInteraction: payload.priority === 'urgent',
    tag: `opportunity-${payload.opportunityId}`,
    image: payload.image
  }
  
  return self.registration.showNotification('New Opportunity', options)
}

function showNewsNotification(payload) {
  const options = {
    body: payload.excerpt || payload.message,
    icon: '/icons/news-icon.png',
    badge: '/icons/badge-icon.png',
    data: payload,
    actions: [
      { action: 'view', title: 'Read Article', icon: '/icons/read-icon.png' }
    ],
    tag: `news-${payload.newsId}`,
    image: payload.featured_image
  }
  
  return self.registration.showNotification('Breaking News', options)
}

function showEntityNotification(payload) {
  const options = {
    body: payload.message || 'Entity update available',
    icon: '/icons/entity-icon.png',
    badge: '/icons/badge-icon.png',
    data: payload,
    actions: [
      { action: 'view', title: 'View Entity', icon: '/icons/view-icon.png' }
    ],
    tag: `entity-${payload.entityId}`
  }
  
  return self.registration.showNotification('Entity Update', options)
}

function showAdminNotification(payload) {
  const options = {
    body: payload.message || 'Admin action required',
    icon: '/icons/admin-icon.png',
    badge: '/icons/badge-icon.png',
    data: payload,
    actions: [
      { action: 'view', title: 'View Admin Panel', icon: '/icons/admin-icon.png' }
    ],
    requireInteraction: true,
    tag: `admin-${payload.id}`,
    vibrate: [200, 100, 200, 100, 200]
  }
  
  return self.registration.showNotification('Admin Alert', options)
}

function showDefaultNotification(payload) {
  const options = {
    body: payload.message || 'You have a new notification',
    icon: '/icons/notification-icon.png',
    badge: '/icons/badge-icon.png',
    data: payload,
    actions: [
      { action: 'view', title: 'View', icon: '/icons/view-icon.png' }
    ],
    tag: payload.tag || 'default'
  }
  
  return self.registration.showNotification('Ring Notification', options)
}

// Helper function to get action URL by notification type
function getActionUrlByType(type) {
  const typeUrls = {
    chat: '/chat',
    opportunity: '/opportunities',
    news: '/news',
    entity: '/entities',
    admin: '/admin',
    notification: '/notifications'
  }
  
  return typeUrls[type] || '/notifications'
}

// Enhanced tracking function
function trackNotificationEngagement(notification, action, actionType = null) {
  const trackingData = {
    action,
    actionType,
    notificationId: notification.data?.notificationId,
    type: notification.data?.type,
    timestamp: Date.now(),
    userAgent: navigator.userAgent
  }
  
  // Store in IndexedDB for offline tracking
  storeEngagementData(trackingData).catch(console.error)
}

// Enhanced sync events for offline functionality
self.addEventListener('sync', (event) => {
  switch (event.tag) {
    case 'background-sync':
      event.waitUntil(syncPendingActions())
      break
    case 'notification-engagement':
      event.waitUntil(syncEngagementTracking())
      break
    default:
      console.log('Unknown sync event:', event.tag)
  }
})

// Enhanced sync functions
async function syncPendingActions() {
  try {
    console.log('Syncing pending actions...')
    
    // Get pending actions from IndexedDB
    const pendingActions = await getPendingActions()
    
    for (const action of pendingActions) {
      try {
        await processPendingAction(action)
        await removePendingAction(action.id)
      } catch (error) {
        console.error('Error processing pending action:', error)
      }
    }
    
  } catch (error) {
    console.error('Error syncing pending actions:', error)
  }
}

async function syncEngagementTracking() {
  try {
    console.log('Syncing engagement tracking...')
    
    const pendingEngagement = await getPendingEngagement()
    
    if (pendingEngagement.length > 0) {
      await fetch('/api/notifications/engagement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events: pendingEngagement })
      })
      
      await clearPendingEngagement()
    }
    
  } catch (error) {
    console.error('Error syncing engagement tracking:', error)
  }
}

// IndexedDB helper functions for offline support
async function storeEngagementData(data) {
  // Implementation for storing engagement data in IndexedDB
  console.log('Storing engagement data:', data)
}

async function getPendingActions() {
  // Implementation for retrieving pending actions from IndexedDB
  return []
}

async function processPendingAction(action) {
  // Implementation for processing pending actions
  console.log('Processing pending action:', action)
}

async function removePendingAction(actionId) {
  // Implementation for removing processed actions
  console.log('Removing pending action:', actionId)
}

async function getPendingEngagement() {
  // Implementation for retrieving pending engagement data
  return []
}

async function clearPendingEngagement() {
  // Implementation for clearing processed engagement data
  console.log('Clearing pending engagement data')
} 