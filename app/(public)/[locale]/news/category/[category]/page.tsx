import React from 'react'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService'
import { NewsArticle, NewsCategory } from '@/features/news/types'
import { NewsList } from '@/features/news/components/news-list'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Rss } from 'lucide-react'
import { LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale, loadTranslations } from '@/i18n-config'
import { getSEOMetadata } from '@/lib/seo-metadata'
import NewsPageWrapper from '@/components/wrappers/news-page-wrapper'

interface CategoryPageParams {
  locale: string
  category: string
}

interface CategoryInfo {
  name: string
  description: string
  color: string
  icon: string
  articleCount: number
}

const categoryInfo: Record<NewsCategory, CategoryInfo> = {
  'platform-updates': {
    name: 'Platform Updates',
    description: 'Latest updates, features, and improvements to Ring Platform',
    color: 'bg-blue-500',
    icon: '🚀',
    articleCount: 0
  },
  'partnerships': {
    name: 'Partnerships',
    description: 'Collaborations, integrations, and partnership announcements',
    color: 'bg-green-500',
    icon: '🤝',
    articleCount: 0
  },
  'community': {
    name: 'Community',
    description: 'Community highlights, events, and member stories',
    color: 'bg-purple-500',
    icon: '👥',
    articleCount: 0
  },
  'industry-news': {
    name: 'Industry News',
    description: 'Web3, blockchain, and decentralized technology news',
    color: 'bg-orange-500',
    icon: '📰',
    articleCount: 0
  },
  'events': {
    name: 'Events',
    description: 'Upcoming events, webinars, and community gatherings',
    color: 'bg-pink-500',
    icon: '📅',
    articleCount: 0
  },
  'announcements': {
    name: 'Announcements',
    description: 'Important announcements and platform communications',
    color: 'bg-yellow-500',
    icon: '📢',
    articleCount: 0
  },
  'press-releases': {
    name: 'Press Releases',
    description: 'Official press releases and media communications',
    color: 'bg-indigo-500',
    icon: '📄',
    articleCount: 0
  },
  'tutorials': {
    name: 'Tutorials',
    description: 'How-to guides, tutorials, and educational content',
    color: 'bg-teal-500',
    icon: '📚',
    articleCount: 0
  },
  'other': {
    name: 'Other',
    description: 'Miscellaneous articles and content',
    color: 'bg-gray-500',
    icon: '📝',
    articleCount: 0
  }
}

/**
 * Get articles for a specific category
 */
async function getCategoryArticles(category: NewsCategory, limit: number = 20): Promise<{
  articles: NewsArticle[]
  totalCount: number
  categoryInfo: CategoryInfo
}> {
  try {
    await initializeDatabase()
    const db = getDatabaseService()

    // Get articles for this category
    const result = await db.query({
      collection: 'news',
      filters: [
        { field: 'category', operator: '==', value: category },
        { field: 'status', operator: '==', value: 'published' },
        { field: 'visibility', operator: 'in', value: ['public', 'subscriber'] }
      ],
      orderBy: [{ field: 'publishedAt', direction: 'desc' }],
      pagination: { limit }
    })

    if (!result.success) {
      return {
        articles: [],
        totalCount: 0,
        categoryInfo: categoryInfo[category]
      }
    }

    const articles = result.data as any[] as NewsArticle[]

    // Get total count for this category
    const countResult = await db.query({
      collection: 'news',
      filters: [
        { field: 'category', operator: '==', value: category },
        { field: 'status', operator: '==', value: 'published' }
      ]
    })

    const totalCount = countResult.success ? countResult.data.length : 0
    const info = { ...categoryInfo[category], articleCount: totalCount }

    return {
      articles,
      totalCount,
      categoryInfo: info
    }
  } catch (error) {
    console.error('Error fetching category articles:', error)
    return {
      articles: [],
      totalCount: 0,
      categoryInfo: categoryInfo[category]
    }
  }
}

export async function generateMetadata({
  params
}: {
  params: Promise<CategoryPageParams>
}): Promise<Metadata> {
  const { locale, category } = await params
  const validLocale = isValidLocale(locale) ? locale : defaultLocale

  // Validate category
  if (!Object.keys(categoryInfo).includes(category)) {
    return {
      title: 'Category Not Found | Ring Platform'
    }
  }

  const categoryData = categoryInfo[category as NewsCategory]
  const t = await loadTranslations(validLocale)

  const title = `${categoryData.name} | ${t.news?.title || 'Ring Platform News'}`
  const description = categoryData.description

  return {
    title,
    description,
    keywords: [
      categoryData.name.toLowerCase(),
      'news',
      'articles',
      'Ring Platform',
      category.replace('-', ' ')
    ],
    openGraph: {
      title,
      description,
      type: 'website',
      locale: validLocale === 'uk' ? 'uk_UA' : 'en_US'
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description
    },
    alternates: {
      canonical: `https://ring.ck.ua/${validLocale}/news/category/${category}`
    }
  }
}

export default async function CategoryPage({
  params
}: {
  params: Promise<CategoryPageParams>
}) {
  const { locale, category } = await params
  const validLocale = isValidLocale(locale) ? locale : defaultLocale

  // Validate category
  if (!Object.keys(categoryInfo).includes(category)) {
    notFound()
  }

  const t = await loadTranslations(validLocale)
  const { articles, totalCount, categoryInfo: catInfo } = await getCategoryArticles(category as NewsCategory)

  // Get localized category name
  const localizedCategoryName = t.news?.categories?.[category as NewsCategory] || catInfo.name

  return (
    <NewsPageWrapper locale={validLocale} categoryInfo={categoryInfo} translations={t}>
      <>
        {/* React 19 Native Metadata */}
        <title>{`${localizedCategoryName} - ${t.news?.title || 'Ring Platform News'}`}</title>
        <meta name="description" content={catInfo.description} />

        <div className="container mx-auto px-0 py-0">
        {/* Back Button */}
        <div className="mb-6">
          <Link href={`/${validLocale}/news`}>
            <Button variant="ghost" className="pl-0">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t.news?.backToNews || 'Back to News'}
            </Button>
          </Link>
        </div>

        {/* Category Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">{catInfo.icon}</span>
            <div>
              <h1 className="text-3xl font-bold">{localizedCategoryName}</h1>
              <p className="text-muted-foreground mt-1">{catInfo.description}</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge className={`${catInfo.color} text-white`}>
                {totalCount} {t.news?.articles || 'articles'}
              </Badge>
            </div>

            {/* RSS Feed Link */}
            <Button variant="outline" size="sm" asChild>
              <a
                href={`/api/news/rss?category=${category}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <Rss className="h-4 w-4" />
                RSS Feed
              </a>
            </Button>
          </div>
        </div>

        {/* Articles List */}
        {articles.length > 0 ? (
          <NewsList
            initialArticles={articles}
            showFilters={true}
            showSearch={true}
            limit={20}
            locale={validLocale}
          />
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="text-6xl mb-4">📭</div>
              <h3 className="text-xl font-semibold mb-2">
                {t.news?.noArticles || 'No articles yet'}
              </h3>
              <p className="text-muted-foreground text-center mb-6">
                There are no published articles in this category yet.
                Check back later for updates.
              </p>
              <Button asChild>
                <Link href={`/${validLocale}/news`}>
                  {t.news?.backToNews || 'Back to News'}
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Related Categories */}
        <div className="mt-16">
          <h2 className="text-2xl font-semibold mb-6">
            {t.news?.allCategories || 'All Categories'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(categoryInfo)
              .filter(([key]) => key !== category)
              .map(([key, info]) => (
                <Card key={key} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-3 text-lg">
                      <span className="text-2xl">{info.icon}</span>
                      <span>
                        {t.news?.categories?.[key as NewsCategory] || info.name}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      {info.description}
                    </p>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/${validLocale}/news/category/${key}`}>
                        View Articles →
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
        </div>
      </>
    </NewsPageWrapper>
  )
}

// Generate static params for all categories
export async function generateStaticParams() {
  const categories = Object.keys(categoryInfo)
  const locales = ['en', 'uk', 'ru']

  const params = []
  for (const locale of locales) {
    for (const category of categories) {
      params.push({
        locale,
        category
      })
    }
  }

  return params
}
