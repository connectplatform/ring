import { Locale } from './i18n-server'

// Updated types for locale-based routing
export interface LocalePageProps<T = {}> {
  params: Promise<{ locale: string } & T>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export interface LocaleMetadataProps<T = {}> {
  params: Promise<{ locale: string } & T>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

// Legacy types for backward compatibility
export interface PageProps<T = {}> {
  params: Promise<T>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export interface MetadataProps<T = {}> {
  params: Promise<T>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/**
 * Utility function to resolve page props (params and searchParams)
 * Works with both legacy and locale-based routing
 * 
 * @param props - The props object containing params and searchParams as Promises
 * @returns A Promise that resolves to the unwrapped params and searchParams
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