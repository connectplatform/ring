# 📚 Ring Platform API Quick Reference

> **Copy-Paste Ready API Patterns for All Ring Platform Endpoints**  
> *80+ documented endpoints with authentication, access control, and React 19 integration*

---

## 🔐 **Authentication APIs**

### **useAuth Hook Usage**
```typescript
// Enhanced authentication hook with status page integration
import { useAuth } from '@/hooks/use-auth'

function MyComponent() {
  const { 
    user, 
    role, 
    loading, 
    hasRole, 
    isAuthenticated,
    navigateToAuthStatus,
    getKycStatus,
    refreshSession 
  } = useAuth()

  // Role-based access control
  if (!hasRole(UserRole.MEMBER)) {
    return <AccessDenied />
  }

  // KYC status management
  const handleKycFlow = () => {
    const status = getKycStatus()
    if (status === 'not_started') {
      navigateToAuthStatus('kyc', 'not_started', { 
        returnTo: '/profile' 
      })
    }
  }

  return (
    <div>
      <h1>Welcome, {user?.name}</h1>
      <p>Role: {role}</p>
      <button onClick={handleKycFlow}>Manage KYC</button>
    </div>
  )
}
```

### **Session Management**
```bash
# NextAuth.js v5 Session
GET  /api/auth/session              # Get current session
POST /api/auth/signin               # User authentication  
POST /api/auth/signout              # User logout
GET  /api/auth/providers            # Available auth providers

# WebSocket Authentication
GET  /api/websocket/auth            # Generate WebSocket JWT token
```

### **Username Validation**
```bash
POST /api/auth/check-username       # Check username availability
```

```typescript
// Check username availability
const checkUsername = async (username: string) => {
  const response = await fetch('/api/auth/check-username', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  })
  
  const { available, suggestions } = await response.json()
  return { available, suggestions }
}
```

### **Crypto Wallet Authentication**
```bash
POST /api/auth/nonce                # Generate wallet nonce
POST /api/auth/wallet               # MetaMask wallet auth
```

```typescript
// Client-side wallet authentication
const response = await fetch('/api/auth/nonce', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ walletAddress })
})
const { nonce } = await response.json()

// Sign and authenticate
const signature = await signer.signMessage(`Sign: ${nonce}`)
await signIn('crypto-wallet', { walletAddress, signedNonce: signature })

// Navigate to auth status page after authentication
const { navigateToAuthStatus } = useAuth()
navigateToAuthStatus('login', 'success', { 
  returnTo: '/dashboard' 
})
```

---

## 👨‍💼 **Admin APIs**

### **User Management**
```bash
GET    /api/admin/users             # List all users with pagination
POST   /api/admin/users             # Create new user
PUT    /api/admin/users/[id]        # Update user details
DELETE /api/admin/users/[id]        # Delete user
```

### **Order Management**
```bash
GET    /api/admin/orders            # List all orders
PUT    /api/admin/orders/[id]       # Update order status
```

### **White Label Management**
```bash
GET    /api/admin/whitelabel        # Get whitelabel configuration
PUT    /api/admin/whitelabel        # Update whitelabel settings
```

```typescript
// Admin user management with role protection
const getUsers = async (page = 1, limit = 20) => {
  const response = await fetch(`/api/admin/users?page=${page}&limit=${limit}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  })
  
  if (!response.ok) {
    throw new Error('Failed to fetch users')
  }
  
  return await response.json()
}

// Update whitelabel configuration
const updateWhitelabel = async (config: WhitelabelConfig) => {
  const response = await fetch('/api/admin/whitelabel', {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify(config)
  })
  
  return await response.json()
}
```

---

## 📊 **Analytics APIs**

### **Application Analytics**
```bash
POST   /api/analytics/app           # Track app-specific events
GET    /api/analytics/app           # Get app analytics data
```

### **Navigation Analytics**
```bash
POST   /api/analytics/navigation    # Track navigation events
GET    /api/analytics/navigation    # Get navigation analytics
```

### **Web Vitals**
```bash
POST   /api/analytics/web-vitals    # Track Core Web Vitals
GET    /api/analytics/web-vitals    # Get performance metrics
```

```typescript
// Track Core Web Vitals
const trackWebVitals = async (metrics: WebVitalsMetrics) => {
  await fetch('/api/analytics/web-vitals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...metrics,
      timestamp: Date.now(),
      url: window.location.href
    })
  })
}

// Track navigation events
const trackNavigation = async (from: string, to: string) => {
  await fetch('/api/analytics/navigation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, timestamp: Date.now() })
  })
}
```

---

## 💬 **Comments APIs**

### **Comment CRUD Operations**
```bash
GET    /api/comments/[articleId]    # Get article comments
POST   /api/comments                # Create new comment
PUT    /api/comments/[id]           # Update comment
DELETE /api/comments/[id]           # Delete comment
```

### **Comment Interactions**
```bash
POST   /api/comments/[id]/like      # Like/unlike comment
GET    /api/comments/[id]/likes     # Get comment likes
```

```typescript
// Create comment with optimistic updates
const createComment = async (articleId: string, content: string) => {
  const response = await fetch('/api/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ articleId, content })
  })
  
  return await response.json()
}

// Like comment with instant feedback
const likeComment = async (commentId: string) => {
  const response = await fetch(`/api/comments/${commentId}/like`, {
    method: 'POST'
  })
  
  return await response.json()
}
```

---

## 🔒 **Confidential APIs**

### **Confidential Entities**
```bash
GET    /api/confidential/entities   # List confidential entities (CONFIDENTIAL+ only)
POST   /api/confidential/entities   # Create confidential entity
```

### **Confidential Opportunities**
```bash
GET    /api/confidential/opportunities  # List confidential opportunities
POST   /api/confidential/opportunities  # Create confidential opportunity
```

```typescript
// Access confidential data with role verification
const getConfidentialEntities = async () => {
  const { hasRole } = useAuth()
  
  if (!hasRole(UserRole.CONFIDENTIAL)) {
    throw new Error('Insufficient permissions')
  }
  
  const response = await fetch('/api/confidential/entities', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  
  return await response.json()
}
```

---

## 💬 **Conversations APIs**

### **Conversation Management**
```bash
GET    /api/conversations           # List user conversations
POST   /api/conversations           # Create new conversation
GET    /api/conversations/[id]      # Get conversation details
PUT    /api/conversations/[id]      # Update conversation
DELETE /api/conversations/[id]      # Delete conversation
```

### **Message Operations**
```bash
GET    /api/conversations/[id]/messages  # Get conversation messages
POST   /api/conversations/[id]/messages  # Send new message
PUT    /api/messages/[id]                # Update message
DELETE /api/messages/[id]                # Delete message
```

### **Real-time Features**
```bash
POST   /api/conversations/[id]/typing    # Send typing indicator
PUT    /api/conversations/[id]/read      # Mark as read
POST   /api/conversations/[id]/upload    # Upload file to conversation
```

```typescript
// Real-time conversation with typing indicators
const sendTypingIndicator = async (conversationId: string, isTyping: boolean) => {
  await fetch(`/api/conversations/${conversationId}/typing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isTyping })
  })
}

// Mark conversation as read
const markAsRead = async (conversationId: string) => {
  await fetch(`/api/conversations/${conversationId}/read`, {
    method: 'PUT'
  })
}

// Upload file to conversation
const uploadToConversation = async (conversationId: string, file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  
  const response = await fetch(`/api/conversations/${conversationId}/upload`, {
    method: 'POST',
    body: formData
  })
  
  return await response.json()
}
```

---

## 🏢 **Entities APIs**

### **Entity CRUD Operations**
```bash
GET    /api/entities                # List entities with filtering
POST   /api/entities                # Create new entity
GET    /api/entities/[id]           # Get specific entity
PUT    /api/entities/[id]           # Update entity
DELETE /api/entities/[id]           # Delete entity
```

### **Entity Features**
```bash
POST   /api/entities/[id]/upload    # Upload entity image/logo
GET    /api/entities/featured       # Get featured entities
```

```typescript
// Create entity with access control
const entityData = {
  name: 'TechCorp Inc.',
  type: 'softwareDevelopment',
  shortDescription: 'AI-powered software solutions',
  location: 'San Francisco, CA',
  isConfidential: false,
  visibility: 'public'
}

const response = await fetch('/api/entities', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(entityData)
})

// Upload entity logo
const uploadEntityLogo = async (entityId: string, file: File) => {
  const formData = new FormData()
  formData.append('logo', file)
  
  const response = await fetch(`/api/entities/${entityId}/upload`, {
    method: 'POST',
    body: formData
  })
  
  return await response.json()
}

// Get featured entities
const getFeaturedEntities = async () => {
  const response = await fetch('/api/entities/featured')
  return await response.json()
}
```

---

## 💬 **Messages APIs**

### **Message CRUD Operations**
```bash
GET    /api/messages/[conversationId] # Get conversation messages
POST   /api/messages                  # Send new message
PUT    /api/messages/[id]             # Update message
DELETE /api/messages/[id]             # Delete message
```

### **Message Interactions**
```bash
POST   /api/messages/[id]/reactions   # Add reaction to message
DELETE /api/messages/[id]/reactions   # Remove reaction
```

```typescript
// Send message with reactions
const sendMessage = async (conversationId: string, content: string) => {
  const response = await fetch('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, content })
  })
  
  return await response.json()
}

// Add reaction to message
const addReaction = async (messageId: string, reaction: string) => {
  const response = await fetch(`/api/messages/${messageId}/reactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reaction })
  })
  
  return await response.json()
}
```

---

## 🗞️ **News APIs**

### **News CRUD Operations**
```bash
GET    /api/news                    # List news articles
POST   /api/news                    # Create news article
GET    /api/news/[id]               # Get specific article
PUT    /api/news/[id]               # Update article
DELETE /api/news/[id]               # Delete article
```

### **News Features**
```bash
GET    /api/news/categories         # Get news categories
POST   /api/news/bulk               # Bulk create articles
POST   /api/news/[id]/like          # Like/unlike article
```

```typescript
// Create news article
const createNewsArticle = async (articleData: NewsArticle) => {
  const response = await fetch('/api/news', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(articleData)
  })
  
  return await response.json()
}

// Get news categories
const getNewsCategories = async () => {
  const response = await fetch('/api/news/categories')
  return await response.json()
}

// Bulk create articles
const bulkCreateArticles = async (articles: NewsArticle[]) => {
  const response = await fetch('/api/news/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ articles })
  })
  
  return await response.json()
}

// Like article with optimistic updates
const likeArticle = async (articleId: string) => {
  const response = await fetch(`/api/news/${articleId}/like`, {
    method: 'POST'
  })
  
  return await response.json()
}
```

---

## 🎨 **NFT Market APIs**

### **NFT Listings**
```bash
GET    /api/nft-market/listings     # List NFT listings
POST   /api/nft-market/listings     # Create new listing
PUT    /api/nft-market/listings/[id] # Update listing
DELETE /api/nft-market/listings/[id] # Delete listing
```

### **NFT Management**
```bash
POST   /api/nft-market/activate     # Activate NFT listing
```

```typescript
// Create NFT listing
const createNFTListing = async (listingData: NFTListing) => {
  const response = await fetch('/api/nft-market/listings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(listingData)
  })
  
  return await response.json()
}

// Activate NFT listing
const activateNFTListing = async (listingId: string) => {
  const response = await fetch('/api/nft-market/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listingId })
  })
  
  return await response.json()
}
```

---

## 🔔 **Notifications APIs**

### **Notification CRUD Operations**
```bash
GET    /api/notifications           # Get user notifications
POST   /api/notifications           # Create notification
PUT    /api/notifications/[id]      # Update notification
DELETE /api/notifications/[id]      # Delete notification
```

### **Notification Management**
```bash
POST   /api/notifications/fcm       # Send FCM notification
GET    /api/notifications/preferences # Get notification preferences
PUT    /api/notifications/preferences # Update preferences
POST   /api/notifications/read-all  # Mark all as read
```

```typescript
// Get notifications with pagination
const getNotifications = async (page = 1, limit = 20) => {
  const response = await fetch(`/api/notifications?page=${page}&limit=${limit}`)
  return await response.json()
}

// Send FCM notification
const sendFCMNotification = async (notification: FCMNotification) => {
  const response = await fetch('/api/notifications/fcm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(notification)
  })
  
  return await response.json()
}

// Update notification preferences
const updateNotificationPreferences = async (preferences: NotificationPreferences) => {
  const response = await fetch('/api/notifications/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preferences)
  })
  
  return await response.json()
}

// Mark all notifications as read
const markAllAsRead = async () => {
  const response = await fetch('/api/notifications/read-all', {
    method: 'POST'
  })
  
  return await response.json()
}
```

---

## 💼 **Opportunities APIs**

### **Opportunity CRUD Operations**
```bash
GET    /api/opportunities           # List opportunities with filtering
POST   /api/opportunities           # Create new opportunity
GET    /api/opportunities/[id]      # Get specific opportunity
PUT    /api/opportunities/[id]      # Update opportunity
DELETE /api/opportunities/[id]      # Delete opportunity
```

### **Opportunity Features**
```bash
POST   /api/opportunities/[id]/upload    # Upload opportunity files
GET    /api/opportunities/featured       # Get featured opportunities
```

```typescript
// Create confidential opportunity
const opportunityData = {
  type: 'offer',
  title: 'Senior React Developer',
  description: 'Lead our React 19 migration project',
  accessTier: 'confidential',
  entityId: 'entity_123',
  budget: { min: 120000, max: 180000, currency: 'USD' },
  location: { type: 'hybrid', city: 'San Francisco' }
}

const response = await fetch('/api/opportunities', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(opportunityData)
})

// Upload opportunity files
const uploadOpportunityFiles = async (opportunityId: string, files: File[]) => {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file))
  
  const response = await fetch(`/api/opportunities/${opportunityId}/upload`, {
    method: 'POST',
    body: formData
  })
  
  return await response.json()
}

// Get featured opportunities
const getFeaturedOpportunities = async () => {
  const response = await fetch('/api/opportunities/featured')
  return await response.json()
}
```

---

## 👤 **Profile APIs**

### **Profile Management**
```bash
GET    /api/profile                 # Get user profile
PUT    /api/profile                 # Update profile
POST   /api/profile/upload          # Upload profile avatar
```

```typescript
// Get user profile
const getProfile = async () => {
  const response = await fetch('/api/profile', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  
  return await response.json()
}

// Update profile
const updateProfile = async (profileData: ProfileData) => {
  const response = await fetch('/api/profile', {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(profileData)
  })
  
  return await response.json()
}

// Upload profile avatar
const uploadAvatar = async (file: File) => {
  const formData = new FormData()
  formData.append('avatar', file)
  
  const response = await fetch('/api/profile/upload', {
    method: 'POST',
    body: formData
  })
  
  return await response.json()
}
```

---

## ⚙️ **Settings APIs**

### **User Settings**
```bash
GET    /api/settings                # Get user settings
PUT    /api/settings                # Update settings
```

```typescript
// Get user settings
const getSettings = async () => {
  const response = await fetch('/api/settings', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  
  return await response.json()
}

// Update settings
const updateSettings = async (settings: UserSettings) => {
  const response = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(settings)
  })
  
  return await response.json()
}
```

---

## 📦 **Shipping APIs**

### **Nova Post Integration**
```bash
GET    /api/shipping/nova-post/cities      # Get Nova Post cities
GET    /api/shipping/nova-post/warehouses  # Get Nova Post warehouses
```

```typescript
// Get Nova Post cities
const getNovaPostCities = async () => {
  const response = await fetch('/api/shipping/nova-post/cities')
  return await response.json()
}

// Get Nova Post warehouses
const getNovaPostWarehouses = async (cityId?: string) => {
  const url = cityId 
    ? `/api/shipping/nova-post/warehouses?cityId=${cityId}`
    : '/api/shipping/nova-post/warehouses'
    
  const response = await fetch(url)
  return await response.json()
}
```

---

## 🛒 **Store APIs**

### **Store Operations**
```bash
POST   /api/store/checkout          # Process checkout
GET    /api/store/orders            # Get user orders
POST   /api/store/orders            # Create new order
GET    /api/store/products          # Get store products
```

```typescript
// Process checkout
const processCheckout = async (checkoutData: CheckoutData) => {
  const response = await fetch('/api/store/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(checkoutData)
  })
  
  return await response.json()
}

// Get user orders
const getUserOrders = async () => {
  const response = await fetch('/api/store/orders', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  
  return await response.json()
}

// Create new order
const createOrder = async (orderData: OrderData) => {
  const response = await fetch('/api/store/orders', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(orderData)
  })
  
  return await response.json()
}

// Get store products
const getStoreProducts = async (filters?: ProductFilters) => {
  const queryParams = filters ? `?${new URLSearchParams(filters)}` : ''
  const response = await fetch(`/api/store/products${queryParams}`)
  
  return await response.json()
}
```

---

## 💰 **Wallet APIs**

### **Wallet Management**
```bash
GET    /api/wallet/balance          # Get wallet balance
POST   /api/wallet/create           # Create new wallet
POST   /api/wallet/ensure           # Ensure wallet exists
GET    /api/wallet/history          # Get transaction history
GET    /api/wallet/list             # List user wallets
PUT    /api/wallet/set-primary      # Set primary wallet
POST   /api/wallet/transfer         # Transfer funds
```

```typescript
// Get wallet balance
const getWalletBalance = async (walletId?: string) => {
  const url = walletId 
    ? `/api/wallet/balance?walletId=${walletId}`
    : '/api/wallet/balance'
    
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  
  return await response.json()
}

// Create new wallet
const createWallet = async (walletData: WalletData) => {
  const response = await fetch('/api/wallet/create', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(walletData)
  })
  
  return await response.json()
}

// Ensure wallet exists
const ensureWallet = async () => {
  const response = await fetch('/api/wallet/ensure', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  
  return await response.json()
}

// Get transaction history
const getTransactionHistory = async (walletId?: string, page = 1) => {
  const params = new URLSearchParams({ page: page.toString() })
  if (walletId) params.append('walletId', walletId)
  
  const response = await fetch(`/api/wallet/history?${params}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  
  return await response.json()
}

// List user wallets
const listWallets = async () => {
  const response = await fetch('/api/wallet/list', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  
  return await response.json()
}

// Set primary wallet
const setPrimaryWallet = async (walletId: string) => {
  const response = await fetch('/api/wallet/set-primary', {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ walletId })
  })
  
  return await response.json()
}

// Transfer funds
const transferFunds = async (transferData: TransferData) => {
  const response = await fetch('/api/wallet/transfer', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(transferData)
  })
  
  return await response.json()
}
```

---

## 🔌 **WebSocket APIs**

### **WebSocket Authentication**
```bash
GET    /api/websocket/auth          # Generate WebSocket JWT token
```

### **Server-Sent Events**
```bash
GET    /api/websocket/sse           # SSE tunnel for real-time updates
```

```typescript
// Get WebSocket authentication token
const getWebSocketToken = async () => {
  const response = await fetch('/api/websocket/auth', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  
  const { wsToken } = await response.json()
  return wsToken
}

// Connect to SSE tunnel
const connectToSSE = (userId: string) => {
  const eventSource = new EventSource(`/api/websocket/sse?userId=${userId}`)
  
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data)
    // Handle real-time updates
    handleRealTimeUpdate(data)
  }
  
  eventSource.onerror = (error) => {
    console.error('SSE connection error:', error)
    eventSource.close()
  }
  
  return eventSource
}
```

---

## 🔧 **Miscellaneous APIs**

### **Platform Information**
```bash
GET    /api/info                    # Get platform information
GET    /api/platform-stats          # Get platform statistics
GET    /api/socket                  # Get socket connection info
```

```typescript
// Get platform information
const getPlatformInfo = async () => {
  const response = await fetch('/api/info')
  return await response.json()
}

// Get platform statistics
const getPlatformStats = async () => {
  const response = await fetch('/api/platform-stats')
  return await response.json()
}

// Get socket connection information
const getSocketInfo = async () => {
  const response = await fetch('/api/socket')
  return await response.json()
}
```

---

## 🛡️ **Access Control Patterns**

### **Role-Based API Protection**
```typescript
// API route with role protection
import { withAuth } from '@/lib/auth-utils'

export const POST = withAuth(async (req, { user }) => {
  if (!hasAccess(user.role, UserRole.MEMBER)) {
    return new Response('Insufficient permissions', { status: 403 })
  }
  
  // Proceed with authenticated logic
  return Response.json({ success: true })
})

// Middleware protection for confidential routes
export default auth((req) => {
  const { pathname } = req.nextUrl
  const { user } = req.auth
  
  if (pathname.startsWith('/api/confidential')) {
    if (!user || !hasConfidentialAccess(user.role)) {
      return new Response('Access denied', { status: 403 })
    }
  }
  
  return NextResponse.next()
})
```

### **Client-Side Access Control**
```typescript
// Component-level access control
function ConfidentialContent() {
  const { user, hasRole } = useAuth()
  
  if (!hasRole(UserRole.CONFIDENTIAL)) {
    return <AccessDenied />
  }
  
  return <ConfidentialData />
}

// Hook for API calls with auth
export function useAuthenticatedFetch() {
  const { data: session } = useSession()
  
  return useCallback(async (url: string, options: RequestInit = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.accessToken}`,
        ...options.headers
      }
    })
  }, [session])
}
```

---

## 🔄 **React 19 Integration Patterns**

### **Optimistic Updates**
```typescript
// News likes with instant feedback
import { useOptimistic } from 'react'

function NewsLikes({ newsId, initialLikes }) {
  const [optimisticLikes, addOptimisticLike] = useOptimistic(
    initialLikes,
    (state, increment) => state + increment
  )
  
  const likeNews = async () => {
    addOptimisticLike(1)
    
    try {
      await fetch(`/api/news/${newsId}/like`, { method: 'POST' })
    } catch (error) {
      // Optimistic update will be reverted automatically
      console.error('Failed to like news:', error)
    }
  }
  
  return (
    <button onClick={likeNews} className="flex items-center gap-2">
      <Heart className="w-4 h-4" />
      {optimisticLikes}
    </button>
  )
}
```

### **Server Actions with Form State**
```typescript
// Entity creation with form state
import { useActionState } from 'react'

function CreateEntityForm() {
  const [state, formAction] = useActionState(createEntityAction, null)
  
  return (
    <form action={formAction}>
      <input name="name" placeholder="Entity name" required />
      <select name="type">
        <option value="softwareDevelopment">Software Development</option>
        <option value="aiMachineLearning">AI/Machine Learning</option>
      </select>
      
      {state?.error && (
        <div className="text-red-500">{state.error}</div>
      )}
      
      <button type="submit">Create Entity</button>
    </form>
  )
}
```

---

## 📱 **Real-time Features**

### **Firebase Real-time Updates**
```typescript
// Real-time entity updates
import { onSnapshot, collection } from 'firebase/firestore'

useEffect(() => {
  const unsubscribe = onSnapshot(
    collection(db, 'entities'),
    (snapshot) => {
      const entities = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      // Filter by user access level
      const accessibleEntities = filterEntitiesByAccess(entities, userRole)
      setEntities(accessibleEntities)
    }
  )
  
  return unsubscribe
}, [userRole])
```

### **WebSocket Message Handling**
```typescript
// Real-time messaging setup
useEffect(() => {
  if (!socket || !conversationId) return
  
  socket.emit('join-conversation', conversationId)
  
  socket.on('new-message', (message) => {
    setMessages(prev => [...prev, message])
    
    // Play notification sound for new messages
    if (message.senderId !== userId) {
      playNotificationSound()
    }
  })
  
  socket.on('user-typing', (data) => {
    setTypingUsers(prev => ({ ...prev, [data.userId]: data.isTyping }))
  })
  
  return () => {
    socket.off('new-message')
    socket.off('user-typing')
  }
}, [socket, conversationId, userId])
```

---

## 🎯 **Common API Response Patterns**

### **Success Responses**
```typescript
// Standard success response
{
  "success": true,
  "data": { /* response data */ },
  "message": "Operation completed successfully"
}

// Paginated response
{
  "entities": [...],
  "lastVisible": "doc_id_123",
  "totalCount": 150,
  "hasMore": true
}
```

### **Error Responses**
```typescript
// Authentication error
{
  "error": "Unauthorized",
  "code": "AUTH_REQUIRED",
  "statusCode": 401
}

// Permission error
{
  "error": "Insufficient permissions",
  "code": "INSUFFICIENT_ROLE",
  "statusCode": 403,
  "requiredRole": "CONFIDENTIAL"
}

// Validation error
{
  "error": "Invalid entity data",
  "code": "VALIDATION_ERROR",
  "statusCode": 400,
  "details": {
    "name": "Required field",
    "type": "Must be valid EntityType"
  }
}
```

---

## 🚀 **Performance Optimization**

### **Caching Headers**
```typescript
// API route with caching
export async function GET() {
  const entities = await getPublicEntities()
  
  return Response.json(entities, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      'CDN-Cache-Control': 'public, s-maxage=300',
      'Vercel-CDN-Cache-Control': 'public, s-maxage=300'
    }
  })
}
```

### **Pagination Implementation**
```typescript
// Efficient pagination
const { entities, lastVisible } = await getEntities(20, startAfter)

// Client-side infinite scroll
const loadMore = async () => {
  if (!lastVisible || loading) return
  
  const response = await fetch(`/api/entities?limit=20&startAfter=${lastVisible}`)
  const data = await response.json()
  
  setEntities(prev => [...prev, ...data.entities])
  setLastVisible(data.lastVisible)
}
```

---

This comprehensive API reference provides copy-paste ready patterns for all 80+ Ring Platform endpoints with proper authentication, access control, and React 19 integration. Each pattern includes error handling, type safety, and performance optimizations.