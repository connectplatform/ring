import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import ProductDetailsWrapper from '@/components/wrappers/product-details-wrapper'
import ProductDetailsClient from './productDetailsClient'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { PostgreSQLStoreAdapter } from '@/features/store/postgresql-adapter'
import { generateProductEmbedding } from '@/lib/vector-search'
import { notFound } from 'next/navigation'

// Loads the product by given ID from PostgreSQL store adapter. 
// Returns the product or null if any error occurs.
async function loadProduct(id: string) {
  try {
    const pgAdapter = new PostgreSQLStoreAdapter()
    return await pgAdapter.getProductById(id)
  } catch (error) {
    console.error('PostgreSQL fetch failed:', error)
    return null
  }
}

// Generates page metadata for SEO and browser, 
// using the locale and id from params (which is a Promise!)
// TODO: Consider using Next.js 16 "generateMetadata" conventions: 
// params should be a plain object, not a Promise. 
// Consider replacing with "params: { locale: string; id: string }".
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}): Promise<Metadata> {
  // Resolve params from the incoming promise.
  const { locale: localeParam, id } = await params

  // Determine the canonical locale.
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  setRequestLocale(locale) // Set Intl locale context

  // Try loading product from primary database.
  let product = await loadProduct(id)

  // If not found, attempt to load from mock data as a fallback (e.g., for dev/demo).
  if (!product) {
    try {
      const { MockStoreAdapter } = await import('@/features/store/mock-adapter')
      const mockAdapter = new MockStoreAdapter()
      const mockProducts = await mockAdapter.listProducts()
      product = mockProducts.find((p) => p.id === id) ?? null
    } catch {
      product = null
    }
  }

  // If still no product found, return fallback generic metadata.
  if (!product) {
    return { title: 'Product - Ring Store' }
  }

  // If found, build and return proper localized metadata, including name/description.
  return buildLocalizedMetadata({
    locale,
    path: 'store.product',
    variables: {
      name: product.name,
      description: product.description || 'Product details',
    },
    pathname: `/store/${id}`,
  })
}

// Main page server component for showing product details.
// TODO: Next.js 16 now supports async server components with direct typed param props; 
// Can simplify by making params a plain object: params: { locale: Locale; id: string }
export default async function ProductDetailsPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>
}) {
  // Resolve parameters from promise (currently pre-React 19 pattern).
  const { locale, id } = await params

  // Validate and standardize locale value.
  const validLocale = routing.locales.includes(locale as Locale) ? locale : routing.defaultLocale

  // Attempt to load product from primary source.
  let currentProduct = await loadProduct(id)

  // If primary fetch fails, try fallback mock store.
  if (!currentProduct) {
    try {
      const { MockStoreAdapter } = await import('@/features/store/mock-adapter')
      const mockAdapter = new MockStoreAdapter()
      const mockProducts = await mockAdapter.listProducts()
      currentProduct = mockProducts.find((p) => p.id === id) ?? null
    } catch (mockError) {
      console.error('Mock data fallback also failed:', mockError)
    }
  }

  // If product still not found, show 404 page.
  if (!currentProduct) {
    notFound()
  }

  // If missing embedding, generate it on the fly for vector search.
  if (!currentProduct.embedding) {
    currentProduct.embedding = generateProductEmbedding({
      name: currentProduct.name,
      description: currentProduct.description,
      category: currentProduct.category,
      tags: currentProduct.tags,
    })
  }

  // Render product details within wrapper, providing locale, productId, and product data as props.
  return (
    <ProductDetailsWrapper locale={validLocale} productId={id} currentProduct={currentProduct}>
      <ProductDetailsClient locale={validLocale} id={id} />
    </ProductDetailsWrapper>
  )
}
