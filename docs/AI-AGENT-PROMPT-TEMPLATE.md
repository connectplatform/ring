# 🤖 Ring Platform AI Agent Prompt Template

> **Copy-Paste Initial AI Prompt for Ring Platform Development**  
> *Everything an AI agent needs to know to start working with Ring Platform effectively*

---

## 📋 **Copy This Prompt Template**

```
You are working with Ring Platform, a modern Next.js 15.3.3 + React 19 professional networking platform.

CRITICAL DOCUMENTATION LOCATIONS:
1. Main overview: ring/docs/AI-CODER-KNOWLEDGE-BASE.md
2. Domain-specific work: ALWAYS read both files for any domain you work with:
   - ring/docs/domains/[domain]/README.md (complete overview when available)
   - ring/docs/domains/[domain]/AI-INSTRUCTION-PROMPT.md (AI-optimized API reference)

KEY CONCEPTS:
- Professional networking with entity-opportunity mapping
- Confidential access tiers for premium content (C-level, M&A, stealth startups)
- NextAuth.js v5 with Firebase adapter + MetaMask crypto wallet support
- React 19 optimizations with useOptimistic and useActionState
- Firebase Firestore with real-time subscriptions and security rules

AVAILABLE DOMAINS: auth, entities, opportunities, messaging, analytics, confidential

TECHNOLOGY STACK:
- Frontend: Next.js 15.3.3, React 19, TypeScript 5.8.3
- Authentication: NextAuth.js v5 with multi-provider support (Google, Apple, MetaMask)
- Database: Firebase Firestore with real-time capabilities
- Storage: Vercel Blob for file uploads (25MB max)
- Styling: Tailwind CSS with Radix UI components
- Real-time: WebSocket with Socket.IO for messaging
- Deployment: Vercel with Edge Functions and global CDN

ARCHITECTURE:
Ring Platform uses a 5-layer application architecture:
1. Presentation Layer: React 19 + Next.js App Router (260kB bundle)
2. Data Layer: Firebase Firestore + Vercel Blob storage
3. Application Layer: 44 API endpoints + Server Actions
4. Transport Layer: HTTP + WebSocket + Middleware
5. Infrastructure Layer: Vercel Edge Network

CORE ENTITIES:
1. Users: Professional individuals with role-based access (Visitor → Subscriber → Member → Confidential → Admin)
2. Entities: Professional organizations across 26+ industry types with visibility controls
3. Opportunities: Dual-nature system (Offers/Requests) with tiered access control

ACCESS CONTROL SYSTEM:
- Public: Open to all users
- Subscriber: Enhanced access for registered users
- Member: Entity creation and opportunity posting
- Confidential: Exclusive access to premium content (C-level positions, stealth startups, M&A)
- Admin: Platform administration

KEY FEATURES:
- Professional networking with sophisticated access tiers
- Entity-based organization profiles with 26+ industry types
- Dual-nature opportunities (job offers + service requests)
- Real-time messaging with WebSocket + FCM notifications
- Web3 integration with MetaMask wallet authentication
- Confidential business networking for premium members
- React 19 optimistic updates for instant UI feedback

PERFORMANCE CHARACTERISTICS:
- Bundle Size: 260kB (-55kB from React 19 migration)
- Build Time: 17.0s with TypeScript compilation
- API Response: <200ms average (with role-based filtering)
- Real-time Messaging: <100ms latency via WebSocket
- File Upload: 25MB max via Vercel Blob storage
- Global CDN: <50ms response time

CRITICAL PATTERNS:
1. Always validate user roles before showing confidential content
2. Use NextAuth.js v5 auth() for server-side session management
3. Implement React 19 useOptimistic for instant UI feedback
4. Apply Firebase security rules for data protection
5. Use role-based filtering in all data queries
6. Handle MetaMask wallet authentication with nonce verification
7. Implement proper error boundaries and loading states

CONFIDENTIAL ACCESS RULES:
- Only CONFIDENTIAL and ADMIN roles can view confidential entities/opportunities
- Confidential content includes C-level positions, stealth startups, M&A activities
- Always check user.role before displaying confidential information
- Use middleware protection for confidential routes

FOR CODEBASE WORK: Read domain documentation BEFORE making changes.
FOR NEW FEATURES: Consider access control and role-based permissions from the start.
FOR API WORK: Reference ring/docs/API-QUICK-REFERENCE.md for endpoint patterns.
FOR PERFORMANCE: Check ring/docs/PERFORMANCE-CHARACTERISTICS.md for optimization guidelines.

COMMON IMPORTS:
```typescript
// Authentication
import { auth } from '@/auth'
import { useSession } from 'next-auth/react'

// Database
import { getAdminDb } from '@/lib/firebase-admin.server'
import { collection, query, where, getDocs } from 'firebase/firestore'

// React 19 features
import { useOptimistic, useActionState } from 'react'

// Types
import { UserRole } from '@/features/auth/types'
import { Entity, EntityType } from '@/features/entities/types'
```

ROLE VALIDATION HELPER:
```typescript
function hasAccess(userRole: UserRole, requiredRole: UserRole): boolean {
  const roleHierarchy = {
    visitor: 0, subscriber: 1, member: 2, confidential: 3, admin: 4
  }
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
}
```

Always ensure your code respects the professional networking context and access control requirements.
```

---

## 🎯 **Customization Guidelines**

### **For Specific Domains**
Add domain-specific context when working on particular areas:

```
ADDITIONAL CONTEXT FOR AUTHENTICATION WORK:
- NextAuth.js v5 uses auth() method (replaces getServerSession)
- Support for Google, Apple, and MetaMask crypto wallet providers
- JWT strategy with Firebase adapter for user storage
- Comprehensive KYC verification system for role upgrades
- Role-based middleware protection for routes

ADDITIONAL CONTEXT FOR ENTITY WORK:
- 26+ industry types from 3D printing to quantum computing
- Professional organization profiles with rich metadata
- Member management system for entity teams
- Verification system for enhanced credibility
- Confidential entities visible only to premium members

ADDITIONAL CONTEXT FOR OPPORTUNITY WORK:
- Dual-nature system: Offers (job postings) + Requests (seeking services)
- Access tiers: public, subscriber, member, confidential
- Budget ranges, location flexibility, application tracking
- Entity-opportunity relationships for professional networking
- Premium content includes C-level positions and M&A activities
```

### **For Different Experience Levels**

#### **For Junior Developers**
```
FOCUS AREAS:
- Read the domain documentation thoroughly before starting
- Always test with different user roles (visitor, member, confidential)
- Use TypeScript strictly - Ring Platform has comprehensive type definitions
- Follow the established patterns in existing code
- Ask for code review before making access control changes

SAFETY CHECKLIST:
□ User authentication verified
□ Role permissions checked
□ Error handling implemented
□ TypeScript types used correctly
□ Confidential content properly protected
```

#### **For Senior Developers**
```
ARCHITECTURE CONSIDERATIONS:
- Evaluate performance impact of new features using PERFORMANCE-CHARACTERISTICS.md
- Consider scaling implications for 10k+ concurrent users
- Design with mobile-first responsive patterns
- Implement proper caching strategies for frequently accessed data
- Plan for multi-region deployment scenarios

ADVANCED PATTERNS:
- Leverage React 19 concurrent features for optimal UX
- Implement sophisticated Firebase security rules
- Optimize bundle size and build performance
- Design for offline-first capabilities where appropriate
```

---

## 🔧 **Quick Command Reference**

### **Development Setup**
```bash
# Start Ring Platform development
cd /Users/insight/code/technoring/ring
npm run dev              # Custom server with WebSocket
npm run dev:nextjs       # Standard Next.js dev server
npm run type-check       # TypeScript validation
npm run test             # Jest test suite (95+ tests)
```

### **Common Development Tasks**
```bash
# Build and deployment
npm run build           # Production build with type checking
npm run start           # Production server
npm run analyze         # Bundle size analysis

# Code quality
npm run lint           # ESLint validation
npm run test:coverage  # Test coverage report
```

---

## 📚 **Documentation Hierarchy**

```
Priority 1 (Essential):
├── AI-CODER-KNOWLEDGE-BASE.md      # Start here - main overview
├── PLATFORM-PHILOSOPHY.md          # Understand the core concepts
└── SYSTEM-ARCHITECTURE.md          # Technical foundation

Priority 2 (Domain Work):
├── domains/auth/AI-INSTRUCTION-PROMPT.md        # Authentication patterns
├── domains/entities/AI-INSTRUCTION-PROMPT.md    # Entity management  
├── domains/opportunities/AI-INSTRUCTION-PROMPT.md # Opportunity system
└── domains/messaging/AI-INSTRUCTION-PROMPT.md   # Real-time messaging

Priority 3 (Reference):
├── API-QUICK-REFERENCE.md          # Copy-paste API patterns
├── PERFORMANCE-CHARACTERISTICS.md  # Metrics and benchmarks
└── COMMON-PATTERNS.md              # Reusable code snippets
```

---

## ⚠️ **Common Pitfalls to Avoid**

1. **❌ Bypassing access control** - Always validate user roles for confidential content
2. **❌ Ignoring TypeScript errors** - Ring Platform has strict type definitions
3. **❌ Hardcoding role checks** - Use the established hasAccess() helper function
4. **❌ Skipping error boundaries** - Implement proper error handling for all components
5. **❌ Missing authentication checks** - Verify session on all protected operations
6. **❌ Inconsistent loading states** - Use Suspense boundaries for better UX
7. **❌ Forgetting mobile optimization** - Test on mobile devices and smaller screens

---

## 🎯 **Success Indicators**

Your AI-generated code is successful when it:

✅ **Respects access control** - Different users see appropriate content  
✅ **Uses proper TypeScript** - No type errors or any types  
✅ **Handles errors gracefully** - User-friendly error messages  
✅ **Performs well** - Fast loading and smooth interactions  
✅ **Works on mobile** - Responsive design and touch-friendly  
✅ **Maintains security** - No data leaks or unauthorized access  
✅ **Follows patterns** - Consistent with existing codebase  

---

This template provides everything an AI developer needs to start working with Ring Platform effectively while maintaining security, performance, and user experience standards.