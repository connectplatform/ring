# 🤖 Ring Platform AI Coder Knowledge Base

> **The Complete Machine-First Documentation Hub for Ring Platform**  
> *Everything an AI developer needs to understand and work with Ring Platform's professional networking ecosystem*

---

## 🎯 **What is Ring Platform?**

**Ring Platform** is a modern, enterprise-grade professional networking platform built with Next.js 15.3.3 + React 19, featuring:

- **Professional Networking Philosophy**: Entity-based system connecting businesses, professionals, and opportunities
- **Confidential Access Tiers**: Public → Subscriber → Member → Confidential access levels for premium networking
- **Web3 Integration**: MetaMask authentication, wallet creation, blockchain transactions via ethers.js
- **Real-time Communication**: Enterprise messaging with WebSocket push notifications (<100ms latency) and FCM fallback
- **Modern Architecture**: React 19 optimizations, 44 API endpoints, 95+ comprehensive tests
- **Database Abstraction**: Firebase Firestore with real-time capabilities and security rules

### **Core Philosophy**
Ring Platform operates on three primary entity types:
- **Users**: Professionals, businesses, authenticated via NextAuth.js v5 with crypto wallet support
- **Entities**: Companies, organizations, startups with 26 industry types and verification systems  
- **Opportunities**: Dual-nature system (Offers/Requests) with tiered access control

**Key Innovation**: Confidential access tier creates exclusive networking spaces for C-level positions, stealth startups, M&A activities, and strategic partnerships. **Unified Status Page System** provides consistent workflow feedback across all domains with dynamic [action]/[status] routing. **Enhanced useAuth Hook** offers type-safe authentication with seamless integration to auth status pages and role-based access control. **WebSocket Push Architecture** eliminates polling with real-time push notifications achieving ~90% reduction in API calls.

📚 **[Read the Strategic Philosophy](./PLATFORM-PHILOSOPHY.md)**

### **Technology Stack & Performance**
- **Frontend**: Next.js 15.3.3 with App Router, React 19 with Concurrent Features
- **Bundle Size**: 260kB optimized (-55kB from React 19 migration)
- **Build Time**: 17.0s with TypeScript 5.8.3 compilation
- **Authentication**: NextAuth.js v5 with Firebase adapter, MetaMask crypto wallet support
- **Database**: Firebase Firestore with real-time subscriptions, security rules
- **File Storage**: Vercel Blob with 25MB support and validation
- **Deployment**: Vercel with Edge Functions and global CDN
- **Real-time**: WebSocket push notifications with heartbeat and auto-reconnection

---

## 🎯 **CRITICAL: Domain-Specific Documentation**

**Every Ring Platform domain has comprehensive reference documentation in two files:**

### **📖 README.md** - Complete Domain Overview  
- Architecture and design patterns
- Complete API reference with examples
- Configuration options and React 19 patterns
- Performance characteristics and optimization
- Integration patterns with Firebase

### **🤖 AI-INSTRUCTION-PROMPT.md** - AI-Optimized Instruction Set
- Machine-readable function signatures
- Complete TypeScript type definitions
- Usage patterns and best practices
- Error handling strategies with Firebase
- React 19 optimization guidelines

### **Available Domains with Documentation**
```bash
ring/docs/domains/
├── auth/                   # ✅ NextAuth.js v5 + MetaMask crypto wallet
│   ├── README.md
│   └── AI-INSTRUCTION-PROMPT.md
├── entities/               # ✅ Professional organizations (26 industry types)
│   ├── README.md
│   └── AI-INSTRUCTION-PROMPT.md  
├── opportunities/          # ✅ Dual-nature system (Offers/Requests)
│   ├── README.md
│   └── AI-INSTRUCTION-PROMPT.md
├── messaging/              # ✅ Real-time chat with WebSocket + FCM
│   ├── README.md
│   └── AI-INSTRUCTION-PROMPT.md
├── analytics/              # ✅ Performance tracking + user behavior
│   ├── README.md
│   └── AI-INSTRUCTION-PROMPT.md
├── notifications/          # ✅ FCM push notifications + status pages
│   ├── README.md
│   └── AI-INSTRUCTION-PROMPT.md
└── confidential/           # ✅ Premium tier access control
    ├── README.md
    └── AI-INSTRUCTION-PROMPT.md
```

**🚨 For Deep Domain Work**: Always read both `README.md` and `AI-INSTRUCTION-PROMPT.md` for the specific domain you're working with. These contain the complete, authoritative documentation for each domain's APIs, patterns, and React 19 implementation details.

---

## 📚 **Documentation Layers**

### **Layer 1: Quick Reference**
*For immediate API usage and common patterns*

- [API Quick Reference](./API-QUICK-REFERENCE.md) - All 44 endpoints at a glance
- [Common Patterns](./COMMON-PATTERNS.md) - Copy-paste ready React 19 + TypeScript code
- [Performance Characteristics](./PERFORMANCE-CHARACTERISTICS.md) - Concrete metrics and benchmarks

### **Layer 2: Domain Deep Dives**
*Detailed documentation for each Ring Platform domain*

| Domain | Purpose | Key APIs | Documentation |
|--------|---------|----------|---------------|
| **auth** | NextAuth.js v5, crypto wallets | Session management, JWT, MetaMask | [Auth Docs](./domains/auth/README.md) |
| **entities** | Professional organizations | CRUD, verification, 26 industries | [Entities Docs](./domains/entities/README.md) |
| **opportunities** | Dual-nature system | Offers/Requests, applications | [Opportunities Docs](./domains/opportunities/README.md) |
| **notifications** | WebSocket push + FCM | Real-time notifications, <100ms delivery | [Notifications Docs](./domains/notifications/README.md) |
| **opportunities** | Job/service marketplace | Offers/Requests, tiered access | [Opportunities Docs](./domains/opportunities/README.md) |
| **messaging** | Real-time communication | WebSocket, FCM notifications | [Messaging Docs](./domains/messaging/README.md) |
| **analytics** | User behavior tracking | Events, performance metrics | [Analytics Docs](./domains/analytics/README.md) |
| **confidential** | Premium tier access | C-level content, stealth startups | [Confidential Docs](./domains/confidential/README.md) |

### **Layer 3: Architecture & Concepts**
*Understanding the system design and patterns*

- [System Architecture](./SYSTEM-ARCHITECTURE.md) - 5-layer Next.js application structure
- [Platform Philosophy](./PLATFORM-PHILOSOPHY.md) - Entity-opportunity mapping paradigm
- [Firebase Integration](./architecture/FIREBASE-ARCHITECTURE.md) - Firestore patterns, security rules
- [React 19 Optimizations](./architecture/REACT19-PATTERNS.md) - useOptimistic, useActionState patterns

### **Layer 4: Integration Guides**
*Step-by-step integration tutorials*

- [Authentication Setup](./integration/AUTH-SETUP.md) - NextAuth.js v5 + Firebase + MetaMask
- [Entity Management](./integration/ENTITY-SETUP.md) - Professional organization workflows
- [Confidential Access](./integration/CONFIDENTIAL-SETUP.md) - Premium tier implementation
- [Real-time Messaging](./integration/MESSAGING-SETUP.md) - WebSocket push notifications + FCM fallback

### **Layer 5: Development & Testing**
*Tools and practices for development*

- [Development Setup](./development/DEV-SETUP.md) - Local environment with Firebase
- [Testing Guide](./development/TESTING-GUIDE.md) - 95+ tests with Jest + React Testing Library
- [Performance Monitoring](./development/PERFORMANCE.md) - React 19 optimizations + Web Vitals
- [Deployment Guide](./development/DEPLOYMENT.md) - Vercel deployment with Edge Functions

#### Environment Variables

- AUTH_*: Auth.js v5
- NEXT_PUBLIC_*: Client-visible configuration
- POLYGON_RPC_URL: EVM RPC for wallet
- NOVAPOST_API_KEY: Nova Poshta API key for store shipping city/warehouse lookups

---

## 🚀 **Key Concepts Every AI Coder Must Know**

### **1. NextAuth.js v5 Authentication**
```typescript
// Modern authentication with multiple providers
import { auth } from "@/auth"

export default auth((request) => {
  const { user } = request.auth
  
  // Access control based on user role
  if (user?.role === 'CONFIDENTIAL') {
    // Grant access to confidential content
  }
})
```

### **2. React 19 Optimistic Updates**
```typescript
// News likes with instant feedback
import { useOptimistic } from 'react'

function NewsLikes({ newsId, initialLikes }) {
  const [optimisticLikes, addOptimisticLike] = useOptimistic(
    initialLikes,
    (state, newLike) => state + 1
  )
  
  async function likeNews() {
    addOptimisticLike(1)
    await likeNewsAction(newsId)
  }
  
  return <button onClick={likeNews}>{optimisticLikes} likes</button>
}
```

### **3. WebSocket Real-time Integration**
```typescript
// Real-time WebSocket push notifications
import { useWebSocketNotifications } from '@/hooks/use-websocket'

function NotificationBell() {
  const { unreadCount, notifications, markAsRead } = useWebSocketNotifications()
  
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

### **4. Firebase Real-time Integration**
```typescript
// Real-time Firestore subscriptions
import { onSnapshot, collection } from 'firebase/firestore'

useEffect(() => {
  const unsubscribe = onSnapshot(
    collection(db, 'opportunities'),
    (snapshot) => {
      const opportunities = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setOpportunities(opportunities)
    }
  )
  return unsubscribe
}, [])
```

### **4. Confidential Access Control**
```typescript
// Tiered access validation
function hasConfidentialAccess(userRole: UserRole): boolean {
  return userRole === UserRole.CONFIDENTIAL || userRole === UserRole.ADMIN
}

function filterConfidentialContent<T extends { accessTier: string }>(
  items: T[], 
  userRole: UserRole
): T[] {
  return items.filter(item => {
    if (item.accessTier === 'confidential') {
      return hasConfidentialAccess(userRole)
    }
    return true
  })
}
```

### **5. Crypto Wallet Integration**
```typescript
// MetaMask authentication flow
import { ethers } from 'ethers'

async function authenticateWallet(walletAddress: string) {
  const provider = new ethers.BrowserProvider(window.ethereum)
  const signer = await provider.getSigner()
  
  // Sign nonce for verification
  const message = `Sign this nonce: ${nonce}`
  const signature = await signer.signMessage(message)
  
  // Verify and authenticate
  return await signIn('crypto-wallet', {
    walletAddress,
    signedNonce: signature
  })
}
```

### **6. Event Log + AI Training Pipeline (Production)**
```typescript
// Append and replay events
import { appendEvent, replayEvents } from '@/lib/events/event-log'

await appendEvent({ type: 'opportunity_matched', payload: { opportunity, match }, userId })

await replayEvents(new Date(Date.now() - 7*24*3600*1000), async (e) => {
  console.log('Replaying', e.type)
})
```

```typescript
// Train heuristics from events and perform baseline matching
import { AITrainingPipeline } from '@/lib/ai/training-pipeline'
import { NeuralMatcher } from '@/lib/ai/neural-matcher'

const pipeline = new AITrainingPipeline()
const examples = await pipeline.collectTrainingData()
const patterns = await pipeline.extractPatterns(examples)
await pipeline.updateModels(patterns)
await pipeline.deployUpdates()

const matcher = new NeuralMatcher()
const matches = await matcher.match(opportunity)
```

---

## 🔧 **Essential API Patterns**

### **Authentication Flow**
```typescript
// Session management with NextAuth.js v5
import { auth } from "@/auth"

// Get server-side session
const session = await auth()

// Client-side session
import { useSession } from 'next-auth/react'
const { data: session, status } = useSession()
```

### **Entity Management Flow**
```typescript
// Create professional entity
const entity = await fetch('/api/entities', {
  method: 'POST',
  body: JSON.stringify({
    name: 'TechCorp Inc.',
    industry: 'technology',
    accessTier: 'member',
    verification: { status: 'pending' }
  })
})
```

### **Opportunity Management Flow**
```typescript
// Dual-nature opportunities (offers/requests)
const opportunity = await fetch('/api/opportunities', {
  method: 'POST',
  body: JSON.stringify({
    type: 'offer', // or 'request'
    title: 'Senior React Developer',
    accessTier: 'confidential',
    entityId: 'entity_123'
  })
})
```

### **Real-time Messaging Flow**
```typescript
// WebSocket messaging with Socket.IO
import { io } from 'socket.io-client'

const socket = io()
socket.emit('join-conversation', conversationId)
socket.on('new-message', (message) => {
  setMessages(prev => [...prev, message])
})
```

---

## 📊 **Performance Characteristics**

| Component | Metric | Value | Notes |
|-----------|--------|-------|-------|
| **Bundle Size** | Total | 260kB | After React 19 optimization (-55kB) |
| **Build Time** | Production | 17.0s | TypeScript + React 19 compilation |
| **API Endpoints** | Total | 44 | Complete application coverage |
| **Routes** | Total | 58 | Next.js App Router with code splitting |
| **Tests** | Coverage | 95+ tests | Authentication + Entity + Messaging |
| **Database** | Queries/sec | 1000+ | Firebase Firestore with indexing |
| **Real-time** | WebSocket | <100ms | Message delivery latency |
| **File Upload** | Max Size | 25MB | Vercel Blob with validation |
| **Authentication** | JWT Verify | <5ms | With session caching |
| **Search** | Response | <200ms | Entity/opportunity search |

---

## 🛠️ **Development Commands**

```bash
# Start development environment
cd /Users/insight/code/technoring/ring
npm run dev              # Custom Node.js server with WebSocket
npm run dev:nextjs       # Standard Next.js dev server
npm run dev:ws           # Development with WebSocket support

# Build and deployment
npm run type-check       # TypeScript validation
npm run build           # Production build with type checking
npm run build:skip-types # Fast build without type validation
npm run start           # Production server

# Testing and analysis
npm run test            # Jest test suite (95+ tests)
npm run test:coverage   # Coverage report
npm run analyze         # Bundle size analysis
npm run lint           # ESLint validation
```

---

## 🔍 **Where to Look for Specific Information**

| If you need... | Look in... | Key files |
|----------------|------------|-----------|
| **API signatures** | `AI-INSTRUCTION-PROMPT.md` files | Per domain |
| **Implementation details** | Domain `README.md` files | Per domain |
| **Type definitions** | `features/*/types/` | TypeScript interfaces |
| **Examples** | `__tests__/` directories | Jest test files |
| **Configuration** | `auth.ts`, `firebase.ts` | Root config files |
| **Error handling** | `components/error-boundaries/` | Error components |

---

## 🎓 **Learning Path for AI Coders**

1. **Start Here**: Read this document completely
2. **Understand Architecture**: Review [System Architecture](./SYSTEM-ARCHITECTURE.md)
3. **Learn Core Concepts**: Study [Platform Philosophy](./PLATFORM-PHILOSOPHY.md)
4. **Explore Domains**: Pick relevant domains from Layer 2
5. **Try Examples**: Use patterns from [Common Patterns](./COMMON-PATTERNS.md)
6. **Test Your Code**: Follow [Testing Guide](./development/TESTING-GUIDE.md)

---

## 💡 **Pro Tips for AI Development**

1. **Use React 19 features** - `useOptimistic`, `useActionState` for better UX
2. **Leverage Firebase real-time** - Subscribe to collections for live updates
3. **Implement tiered access** - Always check user role before showing content
4. **Use TypeScript strictly** - Ring Platform has comprehensive type definitions
5. **Test across access tiers** - Visitor, Subscriber, Member, Confidential
6. **Monitor performance** - React 19 provides significant optimization benefits
7. **Handle errors gracefully** - Use error boundaries for component failures

---

## 🚨 **Common Pitfalls to Avoid**

1. ❌ **Don't bypass access control** - Always validate user role for confidential content
2. ❌ **Don't ignore Firebase security rules** - They provide critical data protection
3. ❌ **Don't skip error handling** - Network failures are common with real-time features
4. ❌ **Don't hardcode API endpoints** - Use environment variables
5. ❌ **Don't forget optimistic updates** - React 19 enables better user experiences
6. ❌ **Don't mix access tiers** - Keep confidential and public content separate
7. ❌ **Don't skip authentication checks** - Verify session on protected routes

---

## 📞 **Getting Help**

- **Primary Docs**: Each domain has `AI-INSTRUCTION-PROMPT.md` and `README.md`
- **Type Info**: Check `features/*/types/` directories for TypeScript definitions
- **Examples**: Look in `__tests__/` directories for usage patterns
- **API Reference**: See [API-QUICK-REFERENCE.md](./API-QUICK-REFERENCE.md) for endpoints

---

## 🎯 **AI Coder Initial Prompt Template**

**Copy this into your initial prompt to any AI coder working on Ring Platform:**

```
You are working with Ring Platform, a modern Next.js 15.3.3 + React 19 professional networking platform.

CRITICAL DOCUMENTATION LOCATIONS:
1. Main overview: ring/docs/AI-CODER-KNOWLEDGE-BASE.md
2. Domain-specific work: ALWAYS read both files for any domain you work with:
   - ring/docs/domains/[domain]/README.md (complete overview)
   - ring/docs/domains/[domain]/AI-INSTRUCTION-PROMPT.md (AI-optimized API reference)

KEY CONCEPTS:
- Professional networking with entity-opportunity mapping
- Confidential access tiers for premium content (C-level, M&A, stealth startups)
- NextAuth.js v5 with Firebase adapter + MetaMask crypto wallet support
- React 19 optimizations with useOptimistic and useActionState
- Firebase Firestore with real-time subscriptions and security rules

AVAILABLE DOMAINS: auth, entities, opportunities, messaging, analytics, confidential

TECHNOLOGY STACK: Next.js 15.3.3, React 19, TypeScript 5.8.3, Firebase, NextAuth.js v5, Vercel Blob, Socket.IO

FOR CODEBASE WORK: Read domain documentation BEFORE making changes.
```

---

*This knowledge base is optimized for AI coders and LLMs. It provides machine-first documentation with clear structure, complete API references, and practical examples. Use this as your primary reference when working with Ring Platform.*