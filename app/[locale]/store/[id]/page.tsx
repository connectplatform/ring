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

async function loadProduct(id: string) {
  try {
    const pgAdapter = new PostgreSQLStoreAdapter()
    return await pgAdapter.getProductById(id)
  } catch (error) {
    console.error('PostgreSQL fetch failed:', error)
    return null
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

  let product = await loadProduct(id)
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

  if (!product) {
    return { title: 'Product - Ring Store' }
  }

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

export default async function ProductDetailsPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>
}) {
  const { locale, id } = await params
  const validLocale = routing.locales.includes(locale as Locale) ? locale : routing.defaultLocale

  let currentProduct = await loadProduct(id)

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

  if (!currentProduct) {
    notFound()
  }

  if (!currentProduct.embedding) {
    currentProduct.embedding = generateProductEmbedding({
      name: currentProduct.name,
      description: currentProduct.description,
      category: currentProduct.category,
      tags: currentProduct.tags,
    })
  }

  return (
    <ProductDetailsWrapper locale={validLocale} productId={id} currentProduct={currentProduct}>
      <ProductDetailsClient locale={validLocale} id={id} />
    </ProductDetailsWrapper>
  )
}
