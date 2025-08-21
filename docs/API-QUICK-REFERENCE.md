# 📚 Ring Platform API Quick Reference

> **Copy-Paste Ready API Patterns for All Ring Platform Endpoints**  
> *44 documented endpoints with authentication, access control, and React 19 integration*

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

## 🏢 **Entity Management APIs**

### **Entity CRUD Operations**
```bash
GET    /api/entities                # List entities with filtering
POST   /api/entities                # Create new entity
GET    /api/entities/[id]           # Get specific entity
PUT    /api/entities/[id]           # Update entity
DELETE /api/entities/[id]           # Delete entity
```

### **Confidential Entity Access**
```bash
GET    /api/confidential/entities   # List confidential entities (CONFIDENTIAL+ only)
POST   /api/confidential/entities   # Create confidential entity
```

### **Entity Relationships**
```bash
POST   /api/entities/[id]/members   # Add entity member
DELETE /api/entities/[id]/members/[userId] # Remove member
GET    /api/entities/[id]/opportunities    # Get entity opportunities
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
```

---

## 💼 **Opportunity Management APIs**

### **Opportunity CRUD Operations**
```bash
GET    /api/opportunities           # List opportunities with filtering
POST   /api/opportunities           # Create new opportunity
GET    /api/opportunities/[id]      # Get specific opportunity
PUT    /api/opportunities/[id]      # Update opportunity
DELETE /api/opportunities/[id]      # Delete opportunity
```

### **Dual-Nature System**
```bash
GET    /api/opportunities?type=offer    # Get job offers/services
GET    /api/opportunities?type=request  # Get service requests
```

### **Access Tier Filtering**
```bash
GET    /api/opportunities?tier=public       # Public opportunities
GET    /api/opportunities?tier=confidential # Confidential opportunities (restricted)
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
```

---

## 💬 **Messaging APIs**

### **Conversation Management**
```bash
GET    /api/conversations           # List user conversations
POST   /api/conversations           # Create new conversation
GET    /api/conversations/[id]      # Get conversation details
DELETE /api/conversations/[id]      # Delete conversation
```

### **Message Operations**
```bash
GET    /api/messages/[conversationId] # Get conversation messages
POST   /api/messages                  # Send new message
PUT    /api/messages/[id]/read        # Mark message as read
DELETE /api/messages/[id]             # Delete message
```

### **Real-time WebSocket Events**
```typescript
// Modern WebSocket hooks for messaging
import { useWebSocketMessages } from '@/hooks/use-modern-websocket'

function ChatRoom({ conversationId }) {
  const { 
    messages, 
    typingUsers, 
    sendMessage, 
    startTyping, 
    stopTyping 
  } = useWebSocketMessages(conversationId)
  
  return (
    <div>
      {messages.map(msg => <Message key={msg.id} {...msg} />)}
      {typingUsers.length > 0 && <TypingIndicator users={typingUsers} />}
      <MessageInput 
        onType={startTyping}
        onSend={sendMessage}
      />
    </div>
  )
}
```

---

## 🔔 **Notification APIs**

### **WebSocket Push Notifications**
```typescript
// Real-time notification hooks
import { useWebSocketNotifications } from '@/hooks/use-modern-websocket'

function NotificationCenter() {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead,
    refresh 
  } = useWebSocketNotifications()
  
  return (
    <div>
      <Badge count={unreadCount} />
      {notifications.map(n => (
        <Notification 
          key={n.id}
          {...n}
          onRead={() => markAsRead([n.id])}
        />
      ))}
    </div>
  )
}
```

### **Notification Management**
```bash
GET    /api/notifications           # Get user notifications
POST   /api/notifications           # Create notification
PUT    /api/notifications/[id]/read # Mark as read
DELETE /api/notifications/[id]      # Delete notification
```

### **Push Notification Settings**
```bash
GET    /api/settings/notifications  # Get notification preferences
PUT    /api/settings/notifications  # Update preferences
POST   /api/notifications/subscribe # Subscribe to push notifications
```

---

## 📊 **Analytics APIs**

### **Event Tracking**
```bash
POST   /api/analytics/track         # Track custom events
GET    /api/analytics/dashboard     # Get user analytics dashboard
GET    /api/analytics/performance   # Performance metrics
```

```typescript
// Track user interaction
await fetch('/api/analytics/track', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    event: 'entity_viewed',
    properties: {
      entityId: 'entity_123',
      entityType: 'softwareDevelopment',
      userRole: 'member'
    }
  })
})
```

---

## 🗞️ **News & Content APIs**

### **News Management**
```bash
GET    /api/news                    # List news articles
POST   /api/news                    # Create news article
GET    /api/news/[id]               # Get specific article
PUT    /api/news/[id]/like          # Like article (optimistic updates)
```

### **Comment System**
```bash
GET    /api/comments/[articleId]    # Get article comments
POST   /api/comments                # Add comment
PUT    /api/comments/[id]           # Update comment
DELETE /api/comments/[id]           # Delete comment
```

---

## 📁 **File Upload APIs**

### **Vercel Blob Integration**
```bash
POST   /api/upload                  # Upload file to Vercel Blob
DELETE /api/upload/[filename]       # Delete uploaded file
GET    /api/upload/[filename]       # Get file metadata
```

```typescript
// File upload with validation
const uploadFile = async (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  })
  
  if (!response.ok) {
    throw new Error('Upload failed')
  }
  
  return await response.json() // { url, filename, size }
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
      await fetch(`/api/news/${newsId}/like`, { method: 'PUT' })
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

This API reference provides copy-paste ready patterns for all Ring Platform endpoints with proper authentication, access control, and React 19 integration. Each pattern includes error handling, type safety, and performance optimizations.