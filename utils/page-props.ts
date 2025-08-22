import type { Locale } from '@/i18n-config'

/**
 * Type definitions for Next.js App Router page props with locale support
 * Supports both modern locale-based routing and legacy routing patterns
 */

/**
 * Props interface for pages with locale-based routing
 * Used in app/[locale]/... directory structure
 * 
 * @template T - Additional parameters specific to the page route
 */
export interface LocalePageProps<T = {}> {
  /** Promise resolving to route parameters including locale */
  params: Promise<{ locale: string } & T>
  /** Promise resolving to search parameters from URL query string */
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/**
 * Props interface for metadata generation with locale support
 * Used for generating dynamic metadata in layout.tsx and page.tsx files
 * 
 * @template T - Additional parameters specific to the page route
 */
export interface LocaleMetadataProps<T = {}> {
  /** Promise resolving to route parameters including locale */
  params: Promise<{ locale: string } & T>
  /** Promise resolving to search parameters from URL query string */
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/**
 * Legacy props interface for backward compatibility
 * Used in app/... directory structure without locale routing
 * 
 * @template T - Additional parameters specific to the page route
 */
export interface PageProps<T = {}> {
  /** Promise resolving to route parameters */
  params: Promise<T>
  /** Promise resolving to search parameters from URL query string */
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/**
 * Legacy metadata props interface for backward compatibility
 * Used for generating dynamic metadata without locale support
 * 
 * @template T - Additional parameters specific to the page route
 */
export interface MetadataProps<T = {}> {
  /** Promise resolving to route parameters */
  params: Promise<T>
  /** Promise resolving to search parameters from URL query string */
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/**
 * Utility function to resolve page props (params and searchParams)
 * Works with both legacy and locale-based routing patterns
 * 
 * This function handles the async nature of Next.js App Router props
 * and provides a consistent interface for accessing route data
 * 
 * @param props - The props object containing params and searchParams as Promises
 * @returns A Promise that resolves to the unwrapped params and searchParams
 * 
 * @example
 * ```typescript
 * // In a page component
 * export default async function MyPage(props: LocalePageProps) {
 *   const { params, searchParams } = await resolvePageProps(props);
 *   const locale = params.locale;
 *   const query = searchParams.q;
 * }
 * ```
 */
export async function resolvePageProps<T = {}>(
  props: PageProps<T> | LocalePageProps<T>
): Promise<{
  params: T & { locale?: string }
  searchParams: { [key: string]: string | string[] | undefined }
}> {
  const [params, searchParams] = await Promise.all([
    props.params,
    props.searchParams
  ])

  return {
    params: params as T & { locale?: string },
    searchParams
  }
}