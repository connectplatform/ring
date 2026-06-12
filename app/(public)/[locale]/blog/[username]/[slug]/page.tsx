import type { Metadata } from 'next'
import React from 'react'
import { notFound } from 'next/navigation'
import { db } from '@/lib/database'
import { mapNewsDocument } from '@/lib/news/map-news-document'
import { blogArticlePathname, normalizeBlogHandle } from '@/lib/blog/blog-path'
import { isValidLocale, defaultLocale, type Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import { connection } from 'next/server'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'

type Params = { locale: string; username: string; slug: string }

async function getBlogPost(username: string, slug: string, locale: string) {
  await connection()

  const handle = normalizeBlogHandle(username)
  const result = await db().queryDocs({
    collection: 'news',
    filters: [
      { field: 'blogUsername', operator: '==', value: handle },
      { field: 'slug', operator: '==', value: slug },
      { field: 'locale', operator: '==', value: locale },
      { field: 'status', operator: '==', value: 'published' },
    ],
    pagination: { limit: 1 },
  })
  if (!result.success || result.data.length === 0) return null
  return mapNewsDocument(result.data[0])
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { locale: raw, username, slug } = await params
  if (!username?.trim() || !slug?.trim()) {
    return { title: 'Blog | Ring Platform', robots: { index: false, follow: false } }
  }
  const locale = routing.locales.includes(raw as Locale)
    ? (raw as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  const handle = normalizeBlogHandle(username)
  const article = await getBlogPost(username, slug, locale)
  if (!article) {
    return buildLocalizedMetadata({
      locale,
      path: 'blog.article',
      pathname: blogArticlePathname(username, slug),
      variables: { title: slug, excerpt: '', username: handle },
      robots: { index: false, follow: false },
    })
  }
  return buildLocalizedMetadata({
    locale,
    path: 'blog.article',
    pathname: blogArticlePathname(username, slug),
    variables: {
      title: article.title,
      excerpt: article.excerpt || article.title,
      username: handle,
    },
  })
}

export default async function BlogArticlePage({ params }: { params: Promise<Params> }) {
  await connection()
  const { locale: raw, username, slug } = await params
  if (!username?.trim() || !slug?.trim()) {
    notFound()
  }
  const locale = isValidLocale(raw) ? raw : defaultLocale
  const article = await getBlogPost(username, slug, locale)
  if (!article) notFound()

  return (
    <article className="container mx-auto px-6 py-10 max-w-3xl prose prose-lg">
      <h1>{article.title}</h1>
      <p className="text-sm text-muted-foreground not-prose">
        {article.authorName} · {article.blogUsername}
      </p>
      <div dangerouslySetInnerHTML={{ __html: article.content }} />
    </article>
  )
}
