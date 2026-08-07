import { NextRequest, NextResponse } from 'next/server'
import { connection } from 'next/server'
import { db } from '@/lib/database'
import { NewsArticle, NewsCategory } from '@/features/news/types'
import { mapNewsDocument } from '@/lib/news/map-news-document'

function toDate(value: unknown): Date {
  if (value instanceof Date) return value
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate()
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value)
  }
  return new Date()
}

function generateRSSXML(articles: NewsArticle[], category?: NewsCategory): string {
  const baseUrl = 'https://ring.ck.ua'
  const categoryName = category ? category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'All News'
  const feedUrl = category ? `${baseUrl}/news/category/${category}` : `${baseUrl}/news`
  const rssUrl = category ? `${baseUrl}/api/news/rss?category=${category}` : `${baseUrl}/api/news/rss`

  const rssItems = articles.map(article => {
    const pubDate = toDate(article.publishedAt ?? article.createdAt)
    const articleUrl = `${baseUrl}/en/news/${article.slug}` // Default to English

    return `    <item>
      <title><![CDATA[${article.title}]]></title>
      <description><![CDATA[${article.excerpt}]]></description>
      <link>${articleUrl}</link>
      <guid>${articleUrl}</guid>
      <pubDate>${pubDate.toUTCString()}</pubDate>
      <author><![CDATA[${article.authorName}]]></author>
      <category><![CDATA[${article.category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}]]></category>
      ${article.tags.map(tag => `<category><![CDATA[${tag}]]></category>`).join('\n      ')}
    </item>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title><![CDATA[Ring Platform - ${categoryName}]]></title>
    <description><![CDATA[Latest news and updates from Ring Platform${category ? ` - ${categoryName}` : ''}]]></description>
    <link>${feedUrl}</link>
    <atom:link href="${rssUrl}" rel="self" type="application/rss+xml" />
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <generator>Ring Platform CMS</generator>
    <image>
      <url>${baseUrl}/images/logo.png</url>
      <title>Ring Platform</title>
      <link>${baseUrl}</link>
    </image>
${rssItems}
  </channel>
</rss>`
}

export async function GET(request: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering (uses request.url)

  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') as NewsCategory | null

    // Build query filters
    const filters: Array<{ field: string; operator: string; value: unknown }> = [
      { field: 'status', operator: '==', value: 'published' },
      { field: 'visibility', operator: 'in', value: ['public', 'subscriber'] }
    ]

    if (category) {
      filters.push({ field: 'category', operator: '==', value: category })
    }

    const result = await db().queryDocs({
      collection: 'news',
      filters,
      orderBy: [{ field: 'publishedAt', direction: 'desc' }],
      pagination: { limit: 50 } // RSS feeds typically show recent 50 items
    })

    if (!result.success) {
      return new NextResponse('Failed to fetch articles', { status: 500 })
    }

    const articles = result.data.map((row) => mapNewsDocument(row))

    // Generate RSS XML
    const rssXML = generateRSSXML(articles, category ?? undefined)

    return new NextResponse(rssXML, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    })
  } catch (error) {
    console.error('Error generating RSS feed:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
