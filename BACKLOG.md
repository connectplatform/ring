
# Ring App Next.js 15 Implementation Backlog

## 1. Implement Partial Prerendering

Partial Prerendering can significantly improve the initial load time of data-heavy pages like Directory and Opportunities listings.

### Tasks:

- Update `next.config.mjs` to enable partial prerendering
- Modify Directory and Opportunities pages to use partial prerendering


### Code Snippet:

```javascript
// next.config.mjs
const nextConfig = {
  experimental: {
    ppr: true,
  },
  // ... other configurations
};

export default nextConfig;
```

```typescriptreact
// app/directory/page.tsx
import { Suspense } from 'react'
import EntitiesContent from '@/components/pages/Directory'
import { getEntities } from '@/lib/firebase'

export default async function DirectoryPage() {
  const initialEntities = await getEntities()

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EntitiesContent initialEntities={initialEntities} />
    </Suspense>
  )
}
```

## 2. Leverage React Server Components

Utilize server components for data fetching and static content to reduce client-side JavaScript.

### Tasks:

- Create server components for entity and opportunity listings
- Update existing components to use server components where appropriate


### Code Snippet:

```typescriptreact
// components/ServerRenderedEntityList.tsx
import { getEntities } from '@/lib/firebase'
import Link from 'next/link'

export default async function ServerRenderedEntityList() {
  const entities = await getEntities()

  return (
    <ul>
      {entities.map(entity => (
        <li key={entity.id}>
          <Link href={`/directory/${entity.id}`}>{entity.name}</Link>
        </li>
      ))}
    </ul>
  )
}
```

## 3. Optimize Images with Next.js Image Component

Enhance image loading and optimization using the improved Next.js Image component.

### Tasks:

- Replace existing `<img>` tags with Next.js `<Image>` components
- Implement responsive images for different screen sizes


### Code Snippet:

```typescriptreact
// components/EntityCard.tsx
import Image from 'next/image'
import { Entity } from '@/types'

export default function EntityCard({ entity }: { entity: Entity }) {
  return (
    <div className="card">
      <Image
        src={entity.logo || '/placeholder.svg'}
        alt={entity.name}
        width={100}
        height={100}
        className="rounded-full"
      />
      <h2>{entity.name}</h2>
      <p>{entity.shortDescription}</p>
    </div>
  )
}
```

## 4. Implement App Router and Nested Layouts

Utilize the App Router for improved routing and implement nested layouts for consistent UI.

### Tasks:

- Restructure the project to use the App Router
- Create nested layouts for different sections (e.g., Directory, Opportunities)


### Code Snippet:

```typescriptreact
// app/directory/layout.tsx
export default function DirectoryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="directory-layout">
      <nav>
        {/* Directory navigation */}
      </nav>
      <main>{children}</main>
    </div>
  )
}
```

## 5. Implement Streaming SSR

Use streaming for large data sets to improve perceived load times.

### Tasks:

- Identify components suitable for streaming (e.g., paginated lists)
- Implement streaming in Opportunities and Directory pages


### Code Snippet:

```typescriptreact
// app/opportunities/page.tsx
import { Suspense } from 'react'
import OpportunityList from '@/components/OpportunityList'
import { getOpportunities } from '@/lib/firebase'

export default async function OpportunitiesPage() {
  const opportunities = await getOpportunities()

  return (
    <div>
      <h1>Opportunities</h1>
      <Suspense fallback={<div>Loading opportunities...</div>}>
        <OpportunityList initialOpportunities={opportunities} />
      </Suspense>
    </div>
  )
}
```

## 6. Implement API Route Handlers

Use API routes for server-side operations like form submissions and authentication.

### Tasks:

- Create API routes for contact form submission, authentication, etc.
- Update client-side code to use new API routes


### Code Snippet:

```typescript
// app/api/contact/route.ts
import { NextResponse } from 'next/server'
import { submitContactForm } from '@/lib/firebase'

export async function POST(request: Request) {
  const data = await request.json()
  try {
    await submitContactForm(data)
    return NextResponse.json({ message: 'Form submitted successfully' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to submit form' }, { status: 500 })
  }
}
```

## 7. Improve Error Handling

Implement more robust error boundaries and not-found pages.

### Tasks:

- Create custom error pages (404, 500)
- Implement error boundaries for critical components


### Code Snippet:

```typescriptreact
// app/not-found.tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <div>
      <h2>Not Found</h2>
      <p>Could not find requested resource</p>
      <Link href="/">Return Home</Link>
    </div>
  )
}
```

## 8. Implement Metadata API

Improve SEO by using the new Metadata API for dynamic meta tags.

### Tasks:

- Update pages to use the Metadata API
- Implement dynamic metadata for entity and opportunity pages


### Code Snippet:

```typescriptreact
// app/directory/[id]/page.tsx
import { Metadata } from 'next'
import { getEntityById } from '@/lib/firebase'

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const entity = await getEntityById(params.id)
  return {
    title: entity ? `${entity.name} | Ring App` : 'Entity Not Found',
    description: entity?.shortDescription || 'Entity details',
  }
}

export default function EntityPage({ params }: { params: { id: string } }) {
  // ... component logic
}
```

## 9. Optimize Performance with React Server Actions

Implement React Server Actions for form submissions and data mutations.

### Tasks:

- Identify forms and data mutation points in the application
- Refactor these to use React Server Actions


### Code Snippet:

```typescriptreact
// app/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { submitContactForm } from '@/lib/firebase'

export async function submitContact(formData: FormData) {
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const message = formData.get('message') as string

  await submitContactForm({ name, email, message })
  revalidatePath('/contact')
}
```

```typescriptreact
// components/ContactForm.tsx
import { submitContact } from '@/app/actions'

export default function ContactForm() {
  return (
    <form action={submitContact}>
      <input name="name" type="text" required />
      <input name="email" type="email" required />
      <textarea name="message" required></textarea>
      <button type="submit">Send</button>
    </form>
  )
}
```

## 10. Implement On-demand Revalidation

Use on-demand revalidation to update static pages when data changes.

### Tasks:

- Identify static pages that need frequent updates
- Implement on-demand revalidation for these pages


### Code Snippet:

```typescript
// app/api/revalidate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path')
  
  if (path) {
    revalidatePath(path)
    return NextResponse.json({ revalidated: true, now: Date.now() })
  }

  return NextResponse.json({ revalidated: false, now: Date.now() })
}
```
