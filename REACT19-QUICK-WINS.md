# React 19 / Next.js 15 Quick Wins Guide

## Immediate Implementation Opportunities

### 1. 🎯 Resource Preloading (High Impact, Low Effort)

Create a new file and use it in your root layout immediately:

```tsx
// lib/preload/setup.ts
import { prefetchDNS, preconnect, preload, preinit } from 'react-dom'

export function setupResourcePreloading() {
  // Your current external services
  prefetchDNS('https://api.firebase.google.com')
  prefetchDNS('https://fonts.googleapis.com')
  prefetchDNS('https://www.googleapis.com')
  
  // Critical connections
  preconnect('https://firebasestorage.googleapis.com')
  preconnect('https://identitytoolkit.googleapis.com')
  
  // Preload your custom font
  preload('/fonts/Inter-Bold.woff2', { 
    as: 'font', 
    type: 'font/woff2',
    crossOrigin: 'anonymous' 
  })
  
  // Preinit critical scripts
  if (typeof window !== 'undefined') {
    preinit('/firebase-messaging-sw.js', { as: 'script' })
  }
}
```

### 2. 🚀 Native Document Metadata (Replace Next.js metadata)

Instead of using Next.js metadata exports, use React 19 native approach:

```tsx
// Before (Remove this)
export const metadata: Metadata = {
  title: 'Entities | Ring',
  description: 'Browse entities'
}

// After (Use this in your page component)
export default function EntitiesPage() {
  return (
    <>
      <title>Entities | Ring</title>
      <meta name="description" content="Browse entities in Ring platform" />
      <link rel="canonical" href="https://ring.ck.ua/entities" />
      
      {/* Your page content */}
      <div>...</div>
    </>
  )
}
```

### 3. 📝 Standardized Form Pattern

Create a reusable form template that all forms should follow:

```tsx
// components/forms/base-form.tsx
'use client'

import { useActionState, useOptimistic } from 'react'
import { useFormStatus } from 'react-dom'

function SubmitButton({ children, loadingText = 'Saving...' }) {
  const { pending } = useFormStatus()
  
  return (
    <button 
      type="submit" 
      disabled={pending}
      className={pending ? 'opacity-50' : ''}
    >
      {pending ? loadingText : children}
    </button>
  )
}

export function BaseForm({ 
  serverAction, 
  initialData = null,
  children,
  onSuccess 
}) {
  const [state, formAction] = useActionState(serverAction, null)
  const [optimistic, setOptimistic] = useOptimistic(initialData)
  
  // Handle success
  useEffect(() => {
    if (state?.success && onSuccess) {
      onSuccess(state)
    }
  }, [state, onSuccess])
  
  return (
    <form action={formAction}>
      {state?.error && (
        <div className="error-message">{state.error}</div>
      )}
      
      {children({ optimistic, setOptimistic })}
      
      <SubmitButton>Save</SubmitButton>
    </form>
  )
}
```

### 4. 🔄 Replace forwardRef Pattern

Update your UI components immediately:

```tsx
// OLD - Remove this pattern
import { forwardRef } from 'react'

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (props, ref) => {
    return <button ref={ref} {...props} />
  }
)

// NEW - Use this pattern
interface ButtonProps {
  ref?: React.Ref<HTMLButtonElement>
  // other props
}

function Button({ ref, ...props }: ButtonProps) {
  return <button ref={ref} {...props} />
}
```

### 5. ⚡ Use Hook for Async Data

Implement the new `use()` hook for cleaner async handling:

```tsx
// features/entities/components/entity-details.tsx
import { use } from 'react'

function EntityDetails({ entityPromise }: { entityPromise: Promise<Entity> }) {
  // This automatically handles loading and error states!
  const entity = use(entityPromise)
  
  return (
    <div>
      <h1>{entity.name}</h1>
      <p>{entity.description}</p>
    </div>
  )
}

// Parent component
export default async function EntityPage({ id }) {
  // Create the promise (don't await it)
  const entityPromise = fetch(`/api/entities/${id}`).then(r => r.json())
  
  return (
    <Suspense fallback={<EntitySkeleton />}>
      <EntityDetails entityPromise={entityPromise} />
    </Suspense>
  )
}
```

### 6. 🎨 Server Components by Default

Quick audit - remove unnecessary 'use client':

```tsx
// ❌ BAD - Don't use 'use client' unless needed
'use client'
export function ProductCard({ product }) {
  return (
    <div>
      <h3>{product.name}</h3>
      <p>{product.price}</p>
    </div>
  )
}

// ✅ GOOD - Server Component by default
export function ProductCard({ product }) {
  return (
    <div>
      <h3>{product.name}</h3>
      <p>{product.price}</p>
    </div>
  )
}

// ✅ GOOD - Only use 'use client' when needed
'use client'
export function AddToCartButton({ productId }) {
  const [isAdding, setIsAdding] = useState(false)
  
  const handleClick = () => {
    // Client-side interaction
  }
  
  return <button onClick={handleClick}>Add to Cart</button>
}
```

### 7. 🚦 Parallel Data Fetching

Stop sequential fetching, use parallel:

```tsx
// ❌ BAD - Sequential
export default async function Dashboard() {
  const user = await getUser()
  const entities = await getEntities()
  const stats = await getStats()
  
  return <DashboardContent {...} />
}

// ✅ GOOD - Parallel
export default async function Dashboard() {
  const [user, entities, stats] = await Promise.all([
    getUser(),
    getEntities(),
    getStats()
  ])
  
  return <DashboardContent {...} />
}
```

### 8. 📊 Streaming with Suspense

Add streaming to heavy pages immediately:

```tsx
// app/[locale]/store/page.tsx
export default function StorePage() {
  return (
    <div>
      {/* This renders immediately */}
      <StoreHeader />
      
      {/* This streams in when ready */}
      <Suspense fallback={<ProductGridSkeleton />}>
        <ProductGrid />
      </Suspense>
      
      {/* This also streams independently */}
      <Suspense fallback={<FiltersSkeleton />}>
        <Filters />
      </Suspense>
    </div>
  )
}
```

### 9. 🎯 Cache for Deduplication

Use React's cache to prevent duplicate fetches:

```tsx
// lib/data/cached-fetchers.ts
import { cache } from 'react'

export const getUser = cache(async (id: string) => {
  const res = await fetch(`/api/users/${id}`)
  return res.json()
})

export const getEntity = cache(async (id: string) => {
  const res = await fetch(`/api/entities/${id}`)
  return res.json()
})

// Now these can be called multiple times without duplicate fetches
```

### 10. 🔧 Component Naming Convention

Start using this immediately for new components:

```bash
# Server Components (default)
components/entity-card.tsx
components/user-profile.tsx
components/product-list.tsx

# Client Components (explicit)
components/client/client-theme-toggle.tsx
components/client/client-search-bar.tsx
components/client/client-modal.tsx

# Or alternative pattern
components/theme-toggle.client.tsx
components/search-bar.client.tsx
components/modal.client.tsx
```

## Implementation Checklist

### This Week
- [ ] Add resource preloading to root layout
- [ ] Convert 5 pages to native metadata
- [ ] Update 3 forms to use useActionState
- [ ] Remove forwardRef from UI components
- [ ] Audit and remove unnecessary 'use client'

### Next Week  
- [ ] Implement streaming on slow pages
- [ ] Add cache() to data fetchers
- [ ] Convert more forms to standard pattern
- [ ] Add loading.tsx to main routes
- [ ] Implement error boundaries

### Following Week
- [ ] Complete component reorganization
- [ ] Full streaming implementation
- [ ] Performance testing
- [ ] Documentation update

## Measuring Success

### Before Migration
```bash
# Run these commands now to establish baseline
npm run build
# Note: Bundle size, build time

npm run lighthouse
# Note: Performance score

npm run test
# Note: Test execution time
```

### After Each Phase
Compare:
- Bundle size (target: -30%)
- Build time (target: -40%)  
- Lighthouse score (target: >95)
- LCP (target: <2.5s)
- Test execution (target: -20%)

## Common Pitfalls to Avoid

### ❌ Don't Do This
```tsx
// Using 'use client' everywhere
// Awaiting in components unnecessarily  
// Using useEffect for data fetching
// Keeping old metadata exports
// Using forwardRef
```

### ✅ Do This Instead
```tsx
// Server Components by default
// Parallel data fetching
// Server Actions for mutations
// Native metadata components
// ref as prop
```

## Support Resources

- [React 19 Blog Post](https://react.dev/blog/2024/12/05/react-19)
- [Next.js 15 Docs](https://nextjs.org/docs)
- [Auth.js v5 Migration](https://authjs.dev/guides/upgrade-to-v5)
- [React Compiler](https://react.dev/learn/react-compiler)

## Questions?

Contact the platform team at frontend@technoring or in #techno-platform channel.
