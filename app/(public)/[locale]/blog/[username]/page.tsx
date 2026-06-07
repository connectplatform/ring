import type { Metadata } from 'next'
import React from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService'
import { mapNewsDocument } from '@/lib/news/map-news-document'
import {
  blogArticleHref,
  blogIndexPathname,
  normalizeBlogHandle,
} from '@/lib/blog/blog-path'
import { isValidLocale, defaultLocale, type Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import { connection } from 'next/server'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata, RING_PLATFORM_SEO } from '@/lib/seo-metadata'

type Params = { locale: string; username: string }

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { locale: raw, username } = await params
  if (!username?.trim()) {
    return { title: 'Blog | Ring Platform' }
  }
  const locale = routing.locales.includes(raw as Locale)
    ? (raw as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  const handle = normalizeBlogHandle(username)
  return buildLocalizedMetadata({
    locale,
    path: 'blog.index',
    pathname: blogIndexPathname(username),
    variables: { username: handle },
    siteName: RING_PLATFORM_SEO.siteName,
    twitterSite: RING_PLATFORM_SEO.twitterSite,
  })
}

async function getBlogPosts(username: string, locale: string) {
  await connection()
  await initializeDatabase()
  const db = getDatabaseService()
  const handle = normalizeBlogHandle(username)
  const result = await db.query({
    collection: 'news',
    filters: [
      { field: 'blogUsername', operator: '==', value: handle },
      { field: 'locale', operator: '==', value: locale },
      { field: 'status', operator: '==', value: 'published' },
    ],
    orderBy: [{ field: 'publishedAt', direction: 'desc' }],
    pagination: { limit: 50 },
  })
  if (!result.success) return []
  return result.data.map((row) =>
    mapNewsDocument(row as { id: string; data?: Record<string, unknown> })
  )
}

export default async function BlogIndexPage({ params }: { params: Promise<Params> }) {
  await connection()
  const { locale: raw, username } = await params
  if (!username?.trim()) {
    notFound()
  }
  const locale = isValidLocale(raw) ? raw : defaultLocale
  const posts = await getBlogPosts(username, locale)
  if (posts.length === 0) {
    notFound()
  }

  const displayUser = normalizeBlogHandle(username)

  return (
    <div className="container mx-auto px-6 py-10 max-w-3xl">
      <h1 className="text-3xl font-bold mb-2">{displayUser}</h1>
      <p className="text-muted-foreground mb-8">Personal blog</p>
      <ul className="space-y-6">
        {posts.map((post) => (
          <li key={post.id} className="border-b border-border pb-6">
            <Link
              href={blogArticleHref(locale, username, post.slug)}
              className="text-xl font-semibold hover:text-primary"
            >
              {post.title}
            </Link>
            <p className="text-muted-foreground mt-2 line-clamp-3">{post.excerpt}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
