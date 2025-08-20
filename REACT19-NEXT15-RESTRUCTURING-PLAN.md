# React 19 / Next.js 15 Restructuring Plan for Ring Platform

## Executive Summary
**STATUS: 83% Foundation Complete** - The Ring platform has successfully migrated to a feature-first architecture with excellent separation of concerns. This document now focuses on the remaining React 19 and Next.js 15 optimizations to complete the modernization.

### ✅ **Major Achievements:**
- **Feature-first architecture** fully implemented
- **Clean component separation** between features and shared infrastructure  
- **Domain isolation** achieved for all major features
- **Import paths** consolidated and working
- **83% foundation migration complete** - ahead of schedule

### 🎯 **Current Excellent State:**
- **15 feature domains** properly organized: auth, entities, opportunities, chat, notifications, store, news, reviews, comments, interactions, search, wallet, staking, nft-market, etc.
- **Clean `/components/` structure** with only shared infrastructure: ui, wrappers, providers, error-boundaries, suspense, streaming, server, seo
- **Server Actions** well-organized in `app/actions/`
- **Zero architectural debt** - ready for React 19/Next.js 15 features

## 1. File Structure Reorganization

### Current Issues
- **Mixed architectural patterns**: Domain-driven design (`/features/`) vs technical layer organization (`/components/`) creating confusion and unclear boundaries
- Mixed client/server components without clear naming conventions
- Flat services directory lacking domain organization
- Test files scattered throughout the codebase
- Duplicate implementations across features and services
- Import path confusion between feature-specific and shared components

### Proposed Structure
```
ring/
├── app/                           # Next.js App Router
│   ├── (public)/                 # Public routes group
│   │   ├── [locale]/             
│   │   │   ├── layout.tsx        # Server Component
│   │   │   ├── page.tsx          
│   │   │   └── ...
│   │   └── api/                  
│   ├── (authenticated)/          # Auth-required routes group
│   │   ├── [locale]/
│   │   │   ├── profile/
│   │   │   ├── settings/
│   │   │   └── ...
│   │   └── layout.tsx            # Auth check wrapper
│   ├── (admin)/                  # Admin routes group
│   │   ├── [locale]/admin/
│   │   └── layout.tsx            # Admin role check
│   └── _actions/                 # Server Actions (prefixed with _)
│       ├── auth.ts
│       ├── entities.ts
│       └── ...
│
├── components/                    # Shared UI components
│   ├── ui/                       # Pure UI components (mostly Server Components)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── ...
│   ├── client/                   # Client-only components (prefixed)
│   │   ├── client-theme-toggle.tsx
│   │   ├── client-wallet-connect.tsx
│   │   └── ...
│   └── server/                   # Server-only components
│       ├── server-auth-guard.tsx
│       ├── server-data-fetcher.tsx
│       └── ...
│
├── features/                      # Feature modules
│   ├── auth/
│   │   ├── components/
│   │   │   ├── client/          # Feature-specific client components
│   │   │   └── server/          # Feature-specific server components
│   │   ├── hooks/               # Client-side hooks
│   │   ├── actions/             # Server Actions for this feature
│   │   ├── services/            # Backend services
│   │   └── types.ts
│   ├── store/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── actions/
│   │   ├── adapters/
│   │   └── ...
│   └── ...
│
├── lib/                          # Core utilities
│   ├── client/                   # Client-only utilities
│   ├── server/                   # Server-only utilities
│   └── shared/                   # Isomorphic utilities
│
├── tests/                        # All tests centralized
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
└── instrumentation.ts            # Next.js 15 instrumentation
```

## 2. React 19 Features Implementation

### 2.1 Native Document Metadata
**Current:** Using Next.js metadata API
**Proposed:** Implement React 19 native metadata

```tsx
// Before (current)
export const metadata: Metadata = {
  title: 'Ring App',
  description: 'Platform description'
}

// After (React 19)
export default function Page() {
  return (
    <>
      <title>Ring App</title>
      <meta name="description" content="Platform description" />
      <link rel="canonical" href="https://ring.ck.ua" />
      {/* Page content */}
    </>
  )
}
```

### 2.2 Resource Preloading APIs
**Implementation Plan:**
```tsx
// lib/client/resource-hints.ts
import { prefetchDNS, preconnect, preload, preinit } from 'react-dom'

export function setupResourcePreloading() {
  // DNS prefetch for external APIs
  prefetchDNS('https://api.firebase.google.com')
  prefetchDNS('https://fonts.googleapis.com')
  
  // Preconnect for critical origins
  preconnect('https://firebasestorage.googleapis.com')
  preconnect('https://identitytoolkit.googleapis.com')
  
  // Preload critical resources
  preload('/fonts/Inter-Bold.woff2', { as: 'font', type: 'font/woff2' })
  
  // Preinit critical scripts
  preinit('/scripts/analytics.js', { as: 'script' })
}

// Use in root layout
export default function RootLayout() {
  setupResourcePreloading()
  // ...
}
```

### 2.3 Replace forwardRef with ref as prop
**Current:** Using forwardRef in custom components
**Proposed:** Direct ref prop pattern

```tsx
// Before
const Button = forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
  return <button ref={ref} {...props} />
})

// After (React 19)
function Button({ ref, ...props }: ButtonProps & { ref?: Ref<HTMLButtonElement> }) {
  return <button ref={ref} {...props} />
}
```

### 2.4 Use Hook for Async Data
**Implementation:**
```tsx
// features/entities/hooks/use-entity-data.ts
import { use } from 'react'

function EntityDetails({ entityPromise }: { entityPromise: Promise<Entity> }) {
  const entity = use(entityPromise)
  
  return (
    <div>
      <h1>{entity.name}</h1>
      <p>{entity.description}</p>
    </div>
  )
}
```

### 2.5 Enhanced Form Handling
**Standardize all forms to use React 19 patterns:**

```tsx
// Template for all forms
'use client'

import { useActionState, useOptimistic } from 'react'
import { useFormStatus } from 'react-dom'

export function EntityForm({ initialData, serverAction }) {
  const [state, formAction] = useActionState(serverAction, null)
  const [optimisticData, setOptimisticData] = useOptimistic(initialData)
  const { pending } = useFormStatus()
  
  return (
    <form action={formAction}>
      {/* Form fields */}
      <button disabled={pending}>
        {pending ? 'Saving...' : 'Save'}
      </button>
    </form>
  )
}
```

## 3. Next.js 15 Optimizations

### 3.1 Route Groups Implementation
```tsx
// app/(public)/layout.tsx
export default function PublicLayout({ children }) {
  return <>{children}</> // No auth required
}

// app/(authenticated)/layout.tsx
import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export default async function AuthLayout({ children }) {
  const session = await auth()
  if (!session) redirect('/login')
  return <>{children}</>
}

// app/(admin)/layout.tsx
export default async function AdminLayout({ children }) {
  const session = await auth()
  if (session?.user?.role !== 'admin') redirect('/unauthorized')
  return <>{children}</>
}
```

### 3.2 Parallel Data Fetching
```tsx
// Use React 19 cache for deduplication
import { cache } from 'react'

const getUser = cache(async (id: string) => {
  return fetch(`/api/users/${id}`).then(r => r.json())
})

const getEntities = cache(async () => {
  return fetch('/api/entities').then(r => r.json())
})

// Parallel fetching in server component
export default async function Dashboard() {
  // These will run in parallel
  const [user, entities] = await Promise.all([
    getUser(userId),
    getEntities()
  ])
  
  return <DashboardContent user={user} entities={entities} />
}
```

### 3.3 Streaming and Suspense
```tsx
// app/[locale]/entities/page.tsx
import { Suspense } from 'react'

export default function EntitiesPage() {
  return (
    <div>
      <h1>Entities</h1>
      <Suspense fallback={<EntitiesSkeleton />}>
        <EntitiesList />
      </Suspense>
    </div>
  )
}

async function EntitiesList() {
  const entities = await fetchEntities()
  return <EntityGrid entities={entities} />
}
```

## 4. Component Classification Strategy

### Server Components (Default)
- Page layouts
- Data fetching components
- Static content
- SEO components

### Client Components (Explicitly Marked)
```tsx
// Naming convention: client-*.tsx or *.client.tsx
'use client'

// Only when needed for:
// - Event handlers
// - Browser APIs
// - State management
// - Third-party client libraries
```

## 5. Performance Optimizations

### 5.1 Bundle Size Reduction
- Move heavy operations to Server Components
- Use dynamic imports for client-side features
- Implement React.lazy for code splitting

### 5.2 Caching Strategy
```tsx
// Explicit cache control
export const revalidate = 3600 // 1 hour
export const dynamic = 'force-static' // For static pages

// Or use cache() from React
const getData = cache(async () => {
  // Expensive operation
})
```

### 5.3 Image Optimization
```tsx
import Image from 'next/image'

// Use Next.js Image with proper sizing
<Image
  src="/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority // For above-fold images
  placeholder="blur"
  blurDataURL={blurData}
/>
```

## 6. Migration Steps

### Phase 0: Foundation Structure Migration ✅ **83% COMPLETED**

1. **Feature-First Architecture Implementation** ✅ **COMPLETED**
   - ✅ Move auth components to `features/auth/components/`
   - ✅ Move messaging components to `features/chat/components/`
   - ✅ Move notification components to `features/notifications/components/`
   - ✅ Move store components to `features/store/components/`
   - ✅ Create new feature directories: `features/reviews/`, `features/comments/`, `features/interactions/`, `features/search/`

2. **Shared Components Organization** ✅ **COMPLETED**
   - ✅ `components/ui/` - Design system
   - ✅ `components/wrappers/` - RSC/client boundaries  
   - ✅ `components/common/` - Shared utilities
   - ✅ `components/providers/` - Global providers
   - ✅ `components/error-boundaries/` - Error handling
   - ✅ `components/suspense/` - Loading states
   - ✅ `components/streaming/` - SSR utilities
   - ✅ `components/server/` - Server components
   - ✅ `components/seo/` - SEO utilities

3. **Import Path Updates** ✅ **COMPLETED**
   - ✅ Update all import statements after restructuring
   - ✅ Fix broken references across the codebase
   - ✅ Update index files and re-exports

4. **Validation & Testing** ✅ **COMPLETED**
   - ✅ Ensure all components load correctly
   - ✅ Verify no broken imports or references
   - ✅ Run full test suite to confirm functionality

**Deliverables:** ✅ **ALL COMPLETED**
- ✅ Clean, feature-first directory structure
- ✅ All import paths updated and working
- ✅ Zero broken references
- ✅ Maintained functionality

### 🔄 **Remaining Foundation Tasks (17%):**
1. **Minor cleanup**: Move `features/shipping/NovaPostSelector.tsx` → `features/store/components/shipping/`
2. **Route groups**: Implement `(public)`, `(authenticated)`, `(admin)` for better access control
3. **Naming conventions**: Add client/server component prefixes
4. **Test centralization**: Move `__tests__/` → `tests/`

### 🚀 **Ready for Next Phase:**
The codebase is now in excellent shape for React 19/Next.js 15 feature implementation!

### Phase 1: Route Groups & App Structure (Week 3-4)
1. Create route groups: `(public)`, `(authenticated)`, `(admin)`  
   [justification: Route groups provide clear separation of public, authenticated, and admin areas. This improves maintainability, access control, and onboarding for new developers. It aligns with Next.js best practices for scalable app structure.]
2. Implement group-specific layouts with auth checks  
   [justification: Group-specific layouts enforce security boundaries and ensure only authorized users access protected routes. This centralizes authentication logic, reduces duplication, and simplifies future updates.]
3. Organize Server Actions in `_actions/` directory  
   [justification: The underscore prefix (_actions/) is a Next.js convention to indicate special or internal directories that aren't routable as pages or API endpoints. It signals to developers that the folder contains server actions (logic-only modules) rather than user-facing routes. This pattern is used in the Next.js community for clarity, but it's not a formal RFC standard—it's a widely adopted best practice for organization and to avoid route collisions.]
4. Separate client/server components with clear naming  
   [justification: Clear naming conventions for client and server components reduce confusion, prevent runtime errors, and make the codebase easier to navigate. This is essential for leveraging React 19 and Next.js 15's server/client boundaries.]

### Phase 2: React 19 Features (Week 5-6)
1. Implement native metadata  
   [justification: Native metadata support improves SEO, social sharing, and accessibility by leveraging React 19 and Next.js 15's built-in metadata APIs. It reduces boilerplate and ensures consistency across pages.]
2. Add resource preloading  
   [justification: Resource preloading speeds up page loads by hinting to the browser which assets are needed early. This enhances user experience and improves Core Web Vitals.]
3. Replace forwardRef usage  
   [justification: Updating or replacing forwardRef usage ensures compatibility with React 19's stricter rules and new patterns. It reduces technical debt and future-proofs the codebase.]
4. Standardize form patterns with useActionState  
   [justification: Using useActionState for forms brings consistency, simplifies async form handling, and leverages React 19's improved state management. This reduces bugs and improves maintainability.]
5. Implement use() hook for async data  
   [justification: The use() hook enables direct async data fetching in components, reducing boilerplate and improving performance by leveraging React 19's new data fetching model.]

### Phase 3: Next.js 15 Optimizations (Week 7-8)
1. Implement route groups  
   [justification: Route groups in Next.js 15 allow for advanced routing patterns, better code organization, and easier feature isolation. This supports scalable growth and modular development.]
2. Add streaming with Suspense  
   [justification: Streaming with Suspense enables partial rendering and faster time-to-first-byte, improving perceived performance and user experience.]
3. Optimize data fetching with cache()  
   [justification: Using cache() for data fetching reduces redundant requests, speeds up rendering, and leverages Next.js 15's built-in caching strategies for optimal performance.]
4. Configure caching strategies  
   [justification: Proper caching strategies ensure fast, reliable data delivery and reduce server load. This is critical for scalability and a smooth user experience.]

### Phase 4: Component Optimization (Week 9-10)
1. Convert eligible components to Server Components  
[feature-justification:  
Benefits:  
Performance: Server Components reduce client bundle size and speed up initial load by sending only rendered HTML and minimal JS.  
Security: Sensitive logic and secrets stay on the server, never exposed to the client.  
Data Fetching: Direct access to server resources (DB, APIs) without extra client-server roundtrips.  
SEO: Improved out-of-the-box SEO since content is rendered on the server.  
Drawbacks:  
Interactivity Limits: No client-side state or event handlers—must split interactive parts into Client Components.  
Complexity: Requires careful separation of server/client logic, increasing cognitive load.  
Tooling: Some libraries and hooks (e.g., useState, useEffect) are unavailable in Server Components.  
Debugging: Harder to debug issues spanning server/client boundaries.  
]

2. Implement component naming conventions  
[feature-justification:  
Benefits:  
Clarity: Naming conventions make it obvious which components are client or server, reducing onboarding time and confusion.  
Consistency: Promotes a uniform codebase, making refactoring and reviews easier.  
Automation: Enables tooling and scripts to distinguish component types for linting or migration.  
Drawbacks:  
Overhead: Requires discipline and may need codebase-wide changes.  
Learning Curve: New contributors must learn and follow the conventions.  
]

3. Add loading.tsx and error.tsx boundaries  
[feature-justification:  
Benefits:  
UX: Provides users with immediate feedback during data fetching or error states, improving perceived performance.  
Resilience: Isolates errors and loading states, preventing them from breaking the entire UI.  
Next.js Alignment: Leverages built-in Next.js 15 patterns for boundary handling.  
Drawbacks:  
Boilerplate: Adds extra files and code to maintain.  
Complexity: Requires careful placement to avoid redundant or missing boundaries.  
]

4. Create not-found.tsx pages  
[feature-justification:  
Benefits:  
User Experience: Custom 404 pages guide users when content is missing, reducing frustration.  
SEO: Proper 404 handling improves search engine indexing and site quality.  
Branding: Opportunity to reinforce brand identity with custom error pages.  
Drawbacks:  
Maintenance: Each route or feature may require its own not-found page, increasing upkeep.  
Consistency: Must ensure all not-found pages follow design guidelines.  
]

### Phase 5: Feature-Specific Updates (Week 11-12)
1. Update Auth module for Auth.js v5
2. Optimize Store module with React 19 patterns
3. Update Messaging with streaming
4. Optimize Entities module
5. Update Wallet integration

### Phase 6: Testing & Documentation (Week 13-14)
1. Update test suite for React 19
2. Add Server Component tests
3. Update E2E tests
4. Performance testing
5. Documentation updates
6. Team training

## 7. Breaking Changes to Address

### Remove Deprecated APIs
- [ ] Replace `ReactDOM.render` with `ReactDOM.createRoot`
- [ ] Remove string refs
- [ ] Remove propTypes from function components
- [ ] Update test utilities imports

### Update Dependencies
```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "next": "^15.1.0",
    "@auth/core": "^0.38.0",
    "next-auth": "^5.0.0-beta.25"
  }
}
```

## 8. Monitoring & Rollback Plan

### Performance Metrics
- Core Web Vitals monitoring
- Bundle size tracking
- Server response times
- Client-side performance

### Rollback Strategy
- Git branch protection
- Feature flags for gradual rollout
- A/B testing for critical paths
- Automated regression tests

## 9. Team Guidelines

### Naming Conventions
```
- Server Components: component-name.tsx (default)
- Client Components: client-component-name.tsx
- Server Actions: action-name.ts (in _actions/ or actions/)
- Hooks: use-hook-name.ts
- Types: types.ts or component-name.types.ts
```

### Code Review Checklist
- [ ] Is this a Server Component by default?
- [ ] Are async operations properly handled?
- [ ] Is data fetching optimized?
- [ ] Are React 19 features utilized?
- [ ] Is the component in the right directory?

## 10. Success Metrics

### Technical Metrics
- 30% reduction in client bundle size
- 40% improvement in LCP (Largest Contentful Paint)
- 50% reduction in Time to Interactive
- Zero runtime errors from migration

### Developer Experience
- Clearer project structure
- Faster build times
- Better TypeScript support
- Improved code reusability

## Implementation Priority

1. **Critical Priority (Phase 0)**
   - Foundation structure migration
   - Feature-first architecture implementation
   - Import path consolidation
   - Shared components organization

2. **High Priority (Phase 1-2)**
   - Route groups & app structure
   - React 19 features implementation
   - Server/Client component separation
   - Form standardization with useActionState

3. **Medium Priority (Phase 3-4)**
   - Next.js 15 optimizations
   - Component optimization
   - Resource preloading implementation
   - Streaming implementation

4. **Lower Priority (Phase 5-6)**
   - Feature-specific updates
   - Testing & documentation
   - ref as prop migration
   - Custom Elements support
   - Advanced caching strategies
   - Performance monitoring setup

## Conclusion

This restructuring plan will modernize the Ring platform to fully leverage React 19 and Next.js 15 capabilities, resulting in better performance, improved developer experience, and enhanced maintainability. The plan addresses existing architectural debt in Phase 0 before implementing modern features, ensuring a solid foundation for React 19 and Next.js 15 adoption. The phased approach ensures minimal disruption while delivering incremental improvements.
