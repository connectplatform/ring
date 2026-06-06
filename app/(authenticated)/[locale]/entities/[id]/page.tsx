import type { Metadata } from 'next'
import React, { Suspense } from 'react'
import { redirect, notFound } from 'next/navigation'
import { auth } from "@/auth"
import { ROUTES } from '@/constants/routes'
import { SerializedEntity } from '@/features/entities/types'
import EntityDetailsWrapper from '@/components/wrappers/entity-details-wrapper'
import { LocalePageProps } from '@/utils/page-props'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata, getSeoSiteBaseUrl, RING_PLATFORM_SEO } from '@/lib/seo-metadata'
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}): Promise<Metadata> {
  const { locale: localeParam, id } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  const t = await getTranslations('entities')

  try {
    const entity = await getEntity(id)
    const description =
      entity.shortDescription ||
      entity.fullDescription ||
      `Learn more about ${entity.name} on Ring Platform.`
    return buildLocalizedMetadata({
      locale,
      path: 'entities.detail',
      pathname: `/entities/${id}`,
      variables: { name: entity.name, description },
      fallback: {
        title: `${entity.name} | Ring Platform`,
        description,
        ogImage: entity.logo,
      },
      siteName: RING_PLATFORM_SEO.siteName,
      twitterSite: RING_PLATFORM_SEO.twitterSite,
    })
  } catch {
    return buildLocalizedMetadata({
      locale,
      path: 'entities.detail',
      pathname: `/entities/${id}`,
      fallback: {
        title: t('metadata.title'),
        description: t('metaDescription.description'),
      },
      siteName: RING_PLATFORM_SEO.siteName,
      twitterSite: RING_PLATFORM_SEO.twitterSite,
    })
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
  const validLocale: Locale = routing.locales.includes(params.locale as Locale) ? (params.locale as Locale) : (routing.defaultLocale as Locale)

  const { id } = params

  let entity: SerializedEntity | null = null
  let error: string | null = null

  try {
    entity = await getEntity(id)
  } catch (e) {
    if (e instanceof Error) {
      if (e.name === 'EntityAccessDeniedError') {
        if (e.message.includes('Authentication required')) {
          redirect(ROUTES.LOGIN(validLocale))
        } else {
          redirect(ROUTES.UNAUTHORIZED(validLocale))
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

  const baseUrl = getSeoSiteBaseUrl()

  return (
    <>
      {entity && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": entity.name,
              "description": entity.fullDescription || entity.shortDescription,
              "url": `${baseUrl}${ROUTES.ENTITY(entity.id, validLocale)}`,
              ...(entity.website && { "sameAs": [entity.website] }),
              ...(entity.logo && { "image": entity.logo }),
              ...(entity.type && { "category": entity.type }),
              "inLanguage": validLocale
            })
          }}
        />
      )}

      {/* Back Navigation Bar */}
      <BackBar
        href={ROUTES.ENTITIES(validLocale)}
        title={entity?.name || 'Entity Details'}
        locale={validLocale}
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
          locale={validLocale}
        />
      </Suspense>
    </>
  )
}