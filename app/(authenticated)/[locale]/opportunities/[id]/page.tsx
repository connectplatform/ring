import React, { Suspense } from 'react'
import { redirect, notFound } from 'next/navigation'
import { auth } from '@/auth'
import { headers } from 'next/headers'
import { SerializedOpportunity } from '@/features/opportunities/types'
import { Entity, SerializedEntity } from '@/features/entities/types'
import { Attachment } from '@/features/opportunities/types'
import { UserRole } from '@/features/auth/types'
import OpportunitiesWrapper from '@/components/wrappers/opportunities-wrapper'
import { ROUTES } from '@/constants/routes'

import { LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates, type Locale } from '@/i18n-config'

// Force dynamic rendering for this page to ensure fresh data on every request
export const dynamic = 'force-dynamic'

// Define the type for the route params
type OpportunityParams = { id: string };

/**
 * Fetches opportunity data using unified services with proper error handling.
 * 
 * @param id - The unique identifier of the opportunity to fetch
 * @returns Promise with opportunity and associated entity data
 * @throws OpportunityNotFoundError if opportunity doesn't exist
 * @throws OpportunityAccessDeniedError if user lacks permissions
 */
async function getOpportunityData(
  id: string
): Promise<{ opportunity: SerializedOpportunity | null; entity: SerializedEntity | null }> {
  try {
    // Use unified services with proper authentication and error handling
    const { getSerializedOpportunityById, OpportunityNotFoundError, OpportunityAccessDeniedError } = await import('@/features/opportunities/services/get-opportunity-by-id')
    const { getSerializedEntityById } = await import('@/features/entities/services/get-entity-by-id')
    
    const opportunity = await getSerializedOpportunityById(id)
    
    if (!opportunity) {
      throw new OpportunityNotFoundError(id)
    }

    // Try to get the associated entity if organizationId is available
    let entity: SerializedEntity | null = null
    if (opportunity.organizationId) {
      try {
        entity = await getSerializedEntityById(opportunity.organizationId)
      } catch (entityError) {
        // Continue without entity - this is not a critical error
        // The entity might be confidential or deleted
      }
    }
    
    return { opportunity, entity }
  } catch (error) {
    // Re-throw structured errors as-is
    if (error instanceof Error && (error.name === 'OpportunityNotFoundError' || error.name === 'OpportunityAccessDeniedError')) {
      throw error
    }
    // Wrap unknown errors
    throw new Error('Opportunity retrieval failed')
  }
}

/**
 * Renders the opportunity details page.
 * 
 * User steps:
 * 1. User navigates to the opportunity details page with a specific ID.
 * 2. The page checks user authentication and authorization.
 * 3. If authorized, the page fetches and displays the opportunity details.
 * 4. If the opportunity is confidential, it checks for appropriate user role.
 * 5. The page displays the opportunity details or an error message.
 * 
 * @param props - The page properties including params and searchParams as Promises.
 * @returns Promise<React.ReactNode> - A promise that resolves to the rendered page content.
 */
export default async function OpportunityPage(props: LocalePageProps<OpportunityParams>): Promise<React.ReactNode> {
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

  let opportunity: SerializedOpportunity | null = null
  let entity: SerializedEntity | null = null
  let error: string | null = null

  // Prepare fallback metadata
  let title = (translations as any).metadata?.opportunityDetails || 'Opportunity Details | Ring App';
  let description = (translations as any).metaDescription?.opportunityDetails || 'View opportunity details in the Ring App ecosystem.';
  let canonicalUrl = `https://ring.ck.ua/${locale}/opportunities/${id}`;
  const alternates = generateHreflangAlternates(`/opportunities/${id}`);

  try {
    const data = await getOpportunityData(id)
    opportunity = data.opportunity
    entity = data.entity

    // Generate opportunity-specific metadata
    if (opportunity) {
      title = `${opportunity.title} | Ring App`
      description = opportunity.briefDescription || opportunity.fullDescription
    }

  } catch (e) {
    if (e instanceof Error) {
      if (e.name === 'OpportunityAccessDeniedError') {
        if (e.message.includes('Authentication required')) {
          redirect(ROUTES.LOGIN(locale))
        } else {
          redirect(ROUTES.UNAUTHORIZED(locale))
        }
      } else if (e.name === 'OpportunityNotFoundError') {
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
      {/* React 19 Native Document Metadata - Opportunity-Specific */}
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
      
      {/* Opportunity-specific OpenGraph data */}
      {entity?.logo && <meta property="og:image" content={entity.logo} />}
      {opportunity?.type && <meta property="article:section" content={opportunity.type} />}
      {opportunity?.tags && opportunity.tags.map((tag, index) => (
        <meta key={index} property="article:tag" content={tag} />
      ))}
      
      {/* Twitter Card metadata */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {entity?.logo && <meta name="twitter:image" content={entity.logo} />}
      
      {/* SEO optimization for opportunity pages */}
      <meta name="robots" content="index, follow" />
      <meta name="googlebot" content="index, follow" />
      
      {/* Hreflang alternates */}
      {Object.entries(alternates).map(([lang, url]) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={url as string} />
      ))}

      {/* Opportunity-specific structured data */}
      {opportunity && entity && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "JobPosting",
              "title": opportunity.title,
              "description": opportunity.briefDescription || opportunity.fullDescription,
              "hiringOrganization": {
                "@type": "Organization",
                "name": entity.name,
                ...(entity.logo && { "logo": entity.logo }),
                ...(entity.website && { "url": entity.website })
              },
              "jobLocation": {
                "@type": "Place",
                "address": entity.location
              },
              "url": `${process.env.NEXT_PUBLIC_API_URL}/${locale}/opportunities/${opportunity.id}`,
              ...(opportunity.type && { "employmentType": opportunity.type }),
              "inLanguage": locale,
              "datePosted": opportunity.dateCreated
            })
          }}
        />
      )}

      <Suspense fallback={
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
        </div>
      }>
        <OpportunitiesWrapper 
          initialOpportunity={opportunity ? {
            ...opportunity,
            attachments: opportunity.attachments as Attachment[],
            visibility: opportunity.visibility,
            expirationDate: opportunity.expirationDate // Already a string from serialization
          } : null}
          initialEntity={entity}
          initialError={error}
          lastVisible={null}
          initialLimit={20}
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
 * - Opportunity-specific metadata: Dynamic title and description based on opportunity data
 * - JobPosting structured data: Native <script> tag with JSON-LD for job search optimization
 * - Advanced OpenGraph: Entity logos, opportunity types, and tags
 * - Twitter Cards: Enhanced with entity branding
 * - SEO optimization: Index/follow for public opportunity pages
 * - Preserved all authentication, data fetching, and authorization logic
 */