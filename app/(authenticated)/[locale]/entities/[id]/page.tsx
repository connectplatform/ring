import React, { Suspense } from 'react'
import { redirect, notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from "@/auth"
import { ROUTES } from '@/constants/routes'
import { UserRole } from '@/features/auth/types'
import { Entity, SerializedEntity } from '@/features/entities/types'
import EntityDetailsWrapper from '@/components/wrappers/entity-details-wrapper'
import { LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates, type Locale } from '@/i18n-config'
import BackBar from '@/components/common/back-bar'

// Allow caching for entity details with moderate revalidation for content updates

// Define the type for the route params
type EntityParams = { id: string };

/**
 * Fetches a single entity using unified service with proper error handling.
 * 
 * @param id - The ID of the entity to fetch
 * @returns Promise<SerializedEntity> - A promise that resolves to the entity
 * @throws EntityNotFoundError if entity doesn't exist
 * @throws EntityAccessDeniedError if user lacks permissions
 */
async function getEntity(id: string): Promise<SerializedEntity> {
  try {
    // Use the unified service with proper authentication and error handling
    const { getSerializedEntityById, EntityNotFoundError, EntityAccessDeniedError } = await import('@/features/entities/services/get-entity-by-id')
    
    const entity = await getSerializedEntityById(id)
    
    if (!entity) {
      throw new EntityNotFoundError(id)
    }

    return entity
  } catch (error) {
    // Re-throw structured errors as-is
    if (error instanceof Error && (error.name === 'EntityNotFoundError' || error.name === 'EntityAccessDeniedError')) {
      throw error
    }
    // Wrap unknown errors
    throw new Error('Entity retrieval failed')
  }
}

/**
 * Renders the entity details page.
 * 
 * User steps:
 * 1. User navigates to the entity details page with a specific ID.
 * 2. The page checks user authentication and authorization.
 * 3. If authorized, the page fetches and displays the entity details.
 * 
 * @param props - The page properties including params and searchParams as Promises.
 * @returns Promise<React.ReactNode> - A promise that resolves to the rendered page content.
 */
export default async function EntityPage(props: LocalePageProps<EntityParams>): Promise<React.ReactNode> {
  // Resolve params and searchParams
  const params = await props.params
  const searchParams = await props.searchParams

  // Extract and validate locale
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale

  // Load translations for React 19 metadata
  const translations = loadTranslations(locale)

  const { id } = params

  // Authentication is now handled by the unified service
  // No need for manual session checks here

  let entity: SerializedEntity | null = null
  let error: string | null = null

  // Prepare fallback metadata
  let title = (translations as any).metadata?.entityDetails || 'Entity Details | Ring App';
  let description = (translations as any).metaDescription?.entityDetails || 'View entity details in the Ring App ecosystem.';
  let canonicalUrl = `${process.env.NEXT_PUBLIC_API_URL}/${locale}/entities/${id}`;
  const alternates = generateHreflangAlternates(`/entities/${id}`);

  try {
    entity = await getEntity(id)

    // Generate entity-specific metadata
    if (entity) {
      title = `${entity.name} | Ring App`
      description = entity.shortDescription || entity.fullDescription || `Learn more about ${entity.name} in the Ring App ecosystem.`
    }

  } catch (e) {
    if (e instanceof Error) {
      if (e.name === 'EntityAccessDeniedError') {
        if (e.message.includes('Authentication required')) {
          redirect(ROUTES.LOGIN(locale))
        } else {
          redirect(ROUTES.UNAUTHORIZED(locale))
        }
      } else if (e.name === 'EntityNotFoundError') {
        return notFound()
      } else {
        error = "An unexpected error occurred. Please try again later."
      }
    } else {
      error = "An unexpected error occurred. Please try again later."
    }
  }

  // Ready to render

  return (
    <>
      {/* React 19 Native Document Metadata - Entity-Specific */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      
      {/* OpenGraph metadata */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content="article" />
      <meta property="og:locale" content={locale === 'uk' ? 'uk_UA' : 'en_US'} />
      <meta property="og:alternate_locale" content={locale === 'uk' ? 'en_US' : 'uk_UA'} />
      
      {/* Entity-specific OpenGraph data */}
      {entity?.logo && <meta property="og:image" content={entity.logo} />}
      {entity?.type && <meta property="article:section" content={entity.type} />}
      {entity?.tags && entity.tags.map((tag, index) => (
        <meta key={index} property="article:tag" content={tag} />
      ))}
      
      {/* Twitter Card metadata */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {entity?.logo && <meta name="twitter:image" content={entity.logo} />}
      
      {/* SEO optimization for entity pages */}
      <meta name="robots" content="index, follow" />
      <meta name="googlebot" content="index, follow" />
      
      {/* Hreflang alternates */}
      {Object.entries(alternates).map(([lang, url]) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={url as string} />
      ))}

      {/* Entity-specific structured data */}
      {entity && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": entity.name,
              "description": entity.fullDescription || entity.shortDescription,
              "url": `https://ring.ck.ua/${locale}/entities/${entity.id}`,
              ...(entity.website && { "sameAs": [entity.website] }),
              ...(entity.logo && { "image": entity.logo }),
              ...(entity.type && { "category": entity.type }),
              "inLanguage": locale
            })
          }}
        />
      )}

      {/* Back Navigation Bar */}
      <BackBar
        href={`/${locale}/entities`}
        title={entity?.name || 'Entity Details'}
        locale={locale}
      />

      <Suspense fallback={
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
        </div>
      }>
        <EntityDetailsWrapper
          initialEntity={entity}
          initialError={error}
          params={params}
          searchParams={searchParams}
        />
      </Suspense>
    </>
  )
}

/* 
 * OBSOLETE FUNCTIONS (removed with React 19 migration):
 * - generateMetadata() function (replaced by React 19 native document metadata)
 * 
 * React 19 Native Features Used:
 * - Document metadata: <title>, <meta>, <link> tags automatically hoisted to <head>
 * - Entity-specific metadata: Dynamic title and description based on entity data
 * - Structured data: Native <script> tag with JSON-LD for rich search results
 * - Advanced OpenGraph: Entity images, categories, and tags
 * - Twitter Cards: Enhanced with entity-specific imagery
 * - SEO optimization: Index/follow for public entity pages
 * - Preserved all authentication, data fetching, and authorization logic
 */