import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { decodePoolSlugFromRoute } from '@/lib/public-pools/pool-slug'
import { getPublicPoolConfig } from '@/lib/ring-config-core'
import { findPoolBySlug } from '@/features/public-pools/lib/public-pool-db'
import { DaoDetailClient } from './dao-detail-client'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  await connection()
  const { slug } = await params
  const poolSlug = decodePoolSlugFromRoute(slug)
  const { cloneId } = getPublicPoolConfig()
  const pool = await findPoolBySlug(cloneId, poolSlug)

  if (!pool) {
    return { title: 'Pool not found' }
  }

  return {
    title: pool.title,
    description: pool.description,
  }
}

export default async function DaoDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  await connection()
  const { locale: localeParam, slug } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const poolSlug = decodePoolSlugFromRoute(slug)
  const { cloneId } = getPublicPoolConfig()
  const pool = await findPoolBySlug(cloneId, poolSlug)

  if (!pool) {
    notFound()
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-10">
      <DaoDetailClient pool={pool} locale={locale} />
    </div>
  )
}
