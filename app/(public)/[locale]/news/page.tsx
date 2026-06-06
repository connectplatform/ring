import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import React from 'react'
import Link from 'next/link';
import { NewsList } from '@/features/news/components/news-list';
import { FeaturedCarousel } from '@/features/news/components/featured-carousel';
import NewsPageWrapper from '@/components/wrappers/news-page-wrapper';
import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService';
import { NewsArticle, NewsCategory, NewsCategoryInfo } from '@/features/news/types';
import { LocalePageProps, LocaleMetadataProps } from '@/utils/page-props';
import { isValidLocale, defaultLocale } from '@/i18n/shared'
import { loadTranslations } from '@/i18n/load-translations'
import { Rss } from 'lucide-react';

const categoryInfo: Record<NewsCategory, { name: string; description: string; color: string; icon: string; articleCount: number }> = {
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
  },
  security: {
    name: 'Security',
    description: 'Security updates and advisories',
    color: 'bg-red-500',
    icon: '🔒',
    articleCount: 0
  },
  blogs: {
    name: 'Blogs',
    description: 'Member blog posts and community writing',
    color: 'bg-slate-500',
    icon: '✍️',
    articleCount: 0
  }
}

type NewsParams = {};

// Allow caching for better performance - news listings can be cached with periodic refresh

/**
 * Get initial news articles
 * Server Component - native async/await (React 19 pattern)
 */
async function getInitialNews(): Promise<NewsArticle[]> {
  try {
    await initializeDatabase()
    const db = getDatabaseService()
    
    const result = await db.query({
      collection: 'news',
      filters: [
        { field: 'status', operator: '==', value: 'published' },
        { field: 'visibility', operator: 'in', value: ['public', 'subscriber'] }
      ],
      orderBy: [{ field: 'publishedAt', direction: 'desc' }],
      pagination: { limit: 12 }
    });
    
    if (!result.success) {
      console.error('Error fetching news:', result.error)
      return []
    }
    
    return result.data as any[] as NewsArticle[];
  } catch (error) {
    console.error('Error fetching initial news:', error);
    return [];
  }
}

/**
 * Get news categories
 * Server Component - native async/await (React 19 pattern)
 */
async function getNewsCategories(): Promise<NewsCategoryInfo[]> {
  try {
    await initializeDatabase()
    const db = getDatabaseService()
    
    const result = await db.query({
      collection: 'newsCategories',
      orderBy: [{ field: 'name', direction: 'asc' }]
    });
    
    if (!result.success) {
      console.error('Error fetching categories:', result.error)
      return []
    }
    
    return result.data as any[] as NewsCategoryInfo[];
  } catch (error) {
    console.error('Error fetching news categories:', error);
    return [];
  }
}


export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  return buildLocalizedMetadata({
    locale,
    path: 'news.list',
    variables: { 
      count: '12' // Default article count
    },
    pathname: '/news',
    siteName: 'Ring Platform',
    twitterSite: '@RingPlatform',
  })
}

export default async function NewsPage(props: LocalePageProps<NewsParams>) {
  // Resolve params and searchParams
  const params = await props.params;
  const searchParams = await props.searchParams;

  // Extract and validate locale
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale;
  console.log('NewsPage: Using locale', locale);
  // Load translations for the current locale
  const translations = await loadTranslations(locale);

  const [initialArticles, categories] = await Promise.all([
    getInitialNews(),
    getNewsCategories(),
  ]);

  return (
    <NewsPageWrapper 
        locale={locale}
        categoryInfo={categoryInfo}
        translations={translations}
      >
        {/* Content Header */}
        <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm mb-8">
          <div className="container mx-auto px-6 py-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                {translations.news?.title || 'News & Updates'}
              </h1>
              <p className="text-xl text-muted-foreground max-w-3xl">
                {translations.news?.description || 'Stay informed with the latest news, platform updates, partnership announcements, and community highlights from Ring Platform.'}
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-6 max-w-5xl">
          {/* Featured Articles Carousel */}
          <FeaturedCarousel
            articles={initialArticles}
            locale={locale}
            translations={translations}
          />

          {/* All Articles */}
          <div className="mt-12">
            <h2 className="text-2xl font-semibold mb-6">
              {translations.news?.allArticles || 'All Articles'}
            </h2>
            <NewsList
              initialArticles={initialArticles}
              categories={categories}
              showFilters={true}
              showSearch={true}
              limit={12}
              locale={locale}
            />
          </div>
        </div>
      </NewsPageWrapper>
  );
} 