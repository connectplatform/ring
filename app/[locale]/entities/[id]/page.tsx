import React, { Suspense } from 'react'
import { redirect, notFound } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { getServerAuthSession } from "@/auth"
import { ROUTES } from '@/constants/routes'
import { UserRole } from '@/features/auth/types'
import { Entity } from '@/types'
import EntityDetailsWrapper from '@/components/entity-details-wrapper'
import { LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates, Locale } from '@/utils/i18n-server'

// Force dynamic rendering for this page to ensure fresh data on every request
export const dynamic = 'force-dynamic'

// Define the type for the route params
type EntityParams = { id: string };

/**
 * Fetches a single entity from the API.
 * 
 * @param session - The authenticated user session.
 * @param id - The ID of the entity to fetch.
 * @returns Promise<Entity> - A promise that resolves to the entity.
 * @throws Error if there's a problem fetching the entity or if the user is unauthorized.
 */
async function getEntity(
  session: any,
  id: string
): Promise<Entity> {
  console.log('getEntity: Starting fetch', { sessionUserId: session.user.id, role: session.user.role, entityId: id });
  
  const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/api/entities/${id}`);
  console.log('getEntity: Fetching from URL', { url: url.toString() });

  try {
    const res = await fetch(url, { 
      cache: 'no-store',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Cookie': cookies().toString(),
      },
    });
    
    console.log('getEntity: Fetch response received', { 
      status: res.status, 
      ok: res.ok,
      statusText: res.statusText
    });

    if (!res.ok) {
      if (res.status === 401) throw new Error('UNAUTHORIZED');
      if (res.status === 403) throw new Error('PERMISSION_DENIED');
      if (res.status === 404) throw new Error('NOT_FOUND');
      throw new Error('FETCH_FAILED');
    }

    const entity = await res.json();
    console.log('getEntity: Entity fetched successfully', { entityId: entity.id });
    return entity;
  } catch (error) {
    console.error('getEntity: Error during fetch:', error);
    throw error;
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
  console.log('EntityPage: Starting');

  // Resolve params and searchParams
  const params = await props.params;
  const searchParams = await props.searchParams;

  // Extract and validate locale
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale;
  console.log('EntityPage: Using locale', locale);

  // Load translations for React 19 metadata
  const translations = loadTranslations(locale);

  console.log('Params:', params);
  console.log('Search Params:', searchParams);

  const { id } = params;

  const cookieStore = await cookies()
  const headersList = await headers()
  const token = cookieStore.get("token");
  const userAgent = headersList.get('user-agent')

  console.log('EntityPage: Request details', {
    entityId: id,
    searchParams,
    locale,
    userAgent,
    hasToken: !!token
  });

  console.log('EntityPage: Authenticating session');
  const session = await getServerAuthSession();
  console.log('EntityPage: Session authenticated', { sessionExists: !!session, userId: session?.user?.id, role: session?.user?.role });

  if (!session) {
    console.log('EntityPage: No session, redirecting to login');
    redirect(ROUTES.LOGIN(locale))
  }

  let entity: Entity | null = null
  let error: string | null = null

  // Prepare fallback metadata
  let title = (translations as any).metadata?.entityDetails || 'Entity Details | Ring App';
  let description = (translations as any).metaDescription?.entityDetails || 'View entity details in the Ring App ecosystem.';
  let canonicalUrl = `https://ring.ck.ua/${locale}/entities/${id}`;
  const alternates = generateHreflangAlternates(`/entities/${id}`);

  try {
    console.log('EntityPage: Fetching Entity');
    entity = await getEntity(session, id)
    console.log('EntityPage: Entity fetched successfully', { entityId: entity.id });

    if (entity.isConfidential && session.user?.role !== UserRole.CONFIDENTIAL && session.user?.role !== UserRole.ADMIN) {
      console.log('EntityPage: Unauthorized access to confidential entity, redirecting');
      redirect(ROUTES.UNAUTHORIZED(locale))
    }

    // Generate entity-specific metadata
    if (entity) {
      title = `${entity.name} | Ring App`;
      description = entity.shortDescription || entity.fullDescription || `Learn more about ${entity.name} in the Ring App ecosystem.`;
    }

  } catch (e) {
    console.error("EntityPage: Error fetching Entity:", e)
    if (e instanceof Error) {
      console.error('EntityPage: Error details', { message: e.message, stack: e.stack });
      if (e.message === 'UNAUTHORIZED') {
        console.log('EntityPage: Unauthorized, redirecting to login');
        redirect(ROUTES.LOGIN(locale))
      } else if (e.message === 'PERMISSION_DENIED') {
        error = "You don't have permission to view this Entity. Please contact an administrator."
      } else if (e.message === 'NOT_FOUND') {
        return notFound()
      } else if (e.message === 'FETCH_FAILED') {
        error = "Failed to load Entity. Please try again later."
      } else {
        error = "An unexpected error occurred. Please try again later."
      }
    } else {
      error = "An unexpected error occurred. Please try again later."
    }
  }

  console.log('EntityPage: Rendering', { hasError: !!error, hasEntity: !!entity });

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
        <link key={lang} rel="alternate" hrefLang={lang} href={url} />
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