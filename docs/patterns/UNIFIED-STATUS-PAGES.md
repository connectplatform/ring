# Unified Status Page Pattern

## Overview

The unified status page pattern provides a consistent, maintainable approach for handling different status states across Ring Platform domains. Instead of creating separate pages for each status (success, failure, error, etc.), this pattern uses dynamic routing with a shared component architecture.

## Implementation Architecture

### 1. Dynamic Route Structure
```
app/(public)/[locale]/[domain]/[feature]/[status]/page.tsx
```

**Example**: `app/(public)/[locale]/store/checkout/[status]/page.tsx`

### 2. Shared Status Component
```
components/[domain]/[Feature]StatusPage.tsx
```

**Example**: `components/store/CheckoutStatusPage.tsx`

### 3. Status Validation
Define valid status types and validate them in the page component:

```typescript
const VALID_STATUSES = [
  'success',
  'failure', 
  'error',
  'cancel',
  'pending',
  'processing',
  'complete'
] as const

type StatusType = typeof VALID_STATUSES[number]
```

## Implementation Steps

### Step 1: Create Dynamic Status Page

```typescript
// app/(public)/[locale]/[domain]/[feature]/[status]/page.tsx
import React, { use } from 'react'
import type { Locale } from '@/i18n-config'
import { StatusPageComponent } from '@/components/[domain]/[Feature]StatusPage'
import { getSEOMetadata } from '@/lib/seo-metadata'
import { isValidLocale, defaultLocale } from '@/i18n-config'
import { notFound } from 'next/navigation'

const VALID_STATUSES = ['success', 'failure', 'error', 'cancel', 'pending', 'processing', 'complete'] as const
type StatusType = typeof VALID_STATUSES[number]

// Metadata will be handled inline using React 19 native approach

export default async function StatusPage({ params }: { params: Promise<{ locale: Locale; status: string }> }) {
  const { locale, status } = await params
  
  if (!VALID_STATUSES.includes(status as StatusType)) {
    notFound()
  }
  
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  
  // Get SEO metadata for the status page
  const seoData = await getSEOMetadata(
    validLocale, 
    '[domain].[feature].status', 
    { 
      status: status.charAt(0).toUpperCase() + status.slice(1) 
    }
  )
  
  return (
    <>
      {/* React 19 Native Metadata */}
      <title>{seoData?.title || `Status ${status.charAt(0).toUpperCase() + status.slice(1)} - Ring Platform`}</title>
      <meta name="description" content={seoData?.description || `Status: ${status}. View your status and next steps.`} />
      {seoData?.keywords && (
        <meta name="keywords" content={seoData.keywords.join(', ')} />
      )}
      {seoData?.canonical && (
        <link rel="canonical" href={seoData.canonical} />
      )}
      
      {/* OpenGraph metadata */}
      <meta property="og:title" content={seoData?.ogTitle || seoData?.title || `Status ${status.charAt(0).toUpperCase() + status.slice(1)} - Ring Platform`} />
      <meta property="og:description" content={seoData?.ogDescription || seoData?.description || `Status: ${status}. View your status and next steps.`} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content={validLocale === 'uk' ? 'uk_UA' : 'en_US'} />
      <meta property="og:site_name" content="Ring Platform" />
      {seoData?.ogImage && (
        <meta property="og:image" content={seoData.ogImage} />
      )}
      
      {/* Twitter Card metadata */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@RingPlatform" />
      <meta name="twitter:title" content={seoData?.twitterTitle || seoData?.title || `Status ${status.charAt(0).toUpperCase() + status.slice(1)}`} />
      <meta name="twitter:description" content={seoData?.twitterDescription || seoData?.description || `Status: ${status}. View your status and next steps.`} />
      {seoData?.twitterImage && (
        <meta name="twitter:image" content={seoData.twitterImage} />
      )}
      
      {/* Hreflang alternates */}
      <link rel="alternate" hrefLang="en" href={`/en/[domain]/[feature]/${status}`} />
      <link rel="alternate" hrefLang="uk" href={`/uk/[domain]/[feature]/${status}`} />
      
      {/* Standard SEO metadata */}
      <meta name="robots" content="index, follow" />
      <meta name="author" content="Ring Platform" />

      <StatusPageComponent status={status as StatusType} locale={locale} />
    </>
  )
}

// Optional: Generate static params for better performance
export async function generateStaticParams() {
  const params = []
  for (const locale of ['en', 'uk'] as const) {
    for (const status of VALID_STATUSES) {
      params.push({ locale, status })
    }
  }
  return params
}
```

### Step 2: Create Status Component

```typescript
// components/[domain]/[Feature]StatusPage.tsx
'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n-config'
import { CheckCircle, XCircle, AlertCircle, Clock, Loader2 } from 'lucide-react'

type StatusType = 'success' | 'failure' | 'error' | 'cancel' | 'pending' | 'processing' | 'complete'

interface StatusPageProps {
  status: StatusType
  locale: Locale
  resourceId?: string
}

const STATUS_CONFIG = {
  success: { icon: CheckCircle, iconColor: 'text-green-500', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
  failure: { icon: XCircle, iconColor: 'text-red-500', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
  error: { icon: XCircle, iconColor: 'text-red-500', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
  cancel: { icon: AlertCircle, iconColor: 'text-orange-500', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
  pending: { icon: Clock, iconColor: 'text-blue-500', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  processing: { icon: Loader2, iconColor: 'text-blue-500', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  complete: { icon: CheckCircle, iconColor: 'text-green-500', bgColor: 'bg-green-50', borderColor: 'border-green-200' }
} as const

export default function FeatureStatusPage({ status, locale, resourceId }: StatusPageProps) {
  const t = useTranslations('modules.[domain].[feature].status')
  const config = STATUS_CONFIG[status]
  const IconComponent = config.icon

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className={`p-8 rounded-lg border-2 ${config.bgColor} ${config.borderColor} shadow-sm`}>
          {/* Status Icon */}
          <div className="flex justify-center mb-6">
            <IconComponent 
              size={64} 
              className={status === 'processing' ? `${config.iconColor} animate-spin` : config.iconColor}
            />
          </div>

          {/* Status Content */}
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {t(`${status}.title`)}
          </h1>
          <p className="text-gray-600 mb-6">
            {t(`${status}.description`)}
          </p>

          {/* Resource ID (if provided) */}
          {resourceId && (
            <div className="bg-white/80 rounded-lg p-4 mb-6 border">
              <p className="text-sm text-gray-600 mb-1">{t('resourceId')}</p>
              <p className="font-mono text-lg font-medium text-gray-900">{resourceId}</p>
            </div>
          )}

          {/* Status-specific Navigation */}
          <div className="space-y-3">
            {/* Add navigation buttons based on status */}
          </div>
        </div>

        {/* Help Link */}
        <div className="mt-6">
          <Link href={ROUTES.CONTACT(locale)} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            {t('needHelp')}
          </Link>
        </div>
      </div>
    </div>
  )
}
```

### Step 3: Add i18n Support

Add translations in `locales/[locale]/modules/[domain].json`:

```json
{
  "[feature]": {
    "status": {
      "resourceId": "Resource ID",
      "needHelp": "Need help? Contact our support team",
      "success": {
        "title": "Success!",
        "description": "The operation completed successfully."
      },
      "failure": {
        "title": "Operation Failed",
        "description": "The operation could not be completed."
      },
      "error": {
        "title": "An Error Occurred",
        "description": "We encountered an unexpected error."
      },
      "cancel": {
        "title": "Operation Cancelled",
        "description": "The operation was cancelled."
      },
      "pending": {
        "title": "Operation Pending",
        "description": "The operation is being processed."
      },
      "processing": {
        "title": "Processing...",
        "description": "Please wait while we process your request."
      },
      "complete": {
        "title": "Complete!",
        "description": "The operation has been completed successfully."
      }
    }
  }
}
```

### Step 4: Add SEO Metadata

Add SEO metadata in `locales/[locale]/seo.json`:

```json
{
  "[domain]": {
    "[feature]": {
      "status": {
        "title": "[Feature] {{status}} - Ring Platform",
        "description": "Your [feature] is {{status}}. View status and next steps."
      }
    }
  }
}
```

### Step 5: Update Routes

Add routes in `constants/routes.ts`:

```typescript
// In ROUTES object
[FEATURE]_STATUS: (locale: Locale = defaultLocale, status: string) => `/${locale}/[domain]/[feature]/${status}`,
```

### Step 6: Add Tests

Create comprehensive tests in `__tests__/[domain]/[feature]-status.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import FeatureStatusPage from '@/components/[domain]/FeatureStatusPage'

describe('FeatureStatusPage', () => {
  it('renders success status correctly', () => {
    // Test implementation
  })
  
  it('renders failure status with retry options', () => {
    // Test implementation
  })
  
  // Add tests for each status and locale
})
```

## Benefits

1. **Code Reusability**: Single component handles all status states
2. **Consistency**: Uniform UX across different status states
3. **Maintainability**: Changes to status handling logic in one place
4. **i18n Support**: Centralized translation keys for all statuses
5. **SEO Optimization**: Dynamic metadata generation for each status
6. **Performance**: Static generation for common status pages
7. **Type Safety**: Compile-time validation of status types

## Best Practices

1. **Status Validation**: Always validate status parameters and use `notFound()` for invalid statuses
2. **Consistent Naming**: Use predictable status names across domains (success, failure, error, etc.)
3. **Progressive Enhancement**: Ensure the page works without JavaScript
4. **Accessibility**: Use proper heading structure and ARIA labels
5. **Error Boundaries**: Wrap status components in error boundaries
6. **Loading States**: Show loading indicators for processing/pending states
7. **Contextual Actions**: Provide relevant next steps for each status

## Example Domains to Implement

- **Authentication**: `/auth/status/[action]/[status]` (login, register, reset-password)
- **Opportunities**: `/opportunities/status/[action]/[status]` (apply, submit, approve)
- **Entities**: `/entities/status/[action]/[status]` (create, verify, approve)
- **Messaging**: `/messages/[action]/[status]` (send, deliver, read)
- **Wallet**: `/wallet/[action]/[status]` (create, fund, transfer)
- **NFT Market**: `/nft/[action]/[status]` (mint, list, buy, sell)

## Migration Strategy

1. **Phase 1**: Implement pattern for new features
2. **Phase 2**: Migrate high-traffic status pages (auth, store)
3. **Phase 3**: Migrate remaining domains
4. **Phase 4**: Remove legacy individual status pages

This pattern reduces code duplication while providing a consistent, maintainable approach to status page handling across the Ring Platform.
