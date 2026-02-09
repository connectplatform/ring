import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { NewsList } from '@/features/news/components/news-list';
import { FeaturedCarousel } from '@/features/news/components/featured-carousel';
import NewsPageWrapper from '@/components/wrappers/news-page-wrapper';
import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService';
import { NewsArticle, NewsCategory, NewsCategoryInfo } from '@/features/news/types';
import { LocalePageProps, LocaleMetadataProps } from '@/utils/page-props';
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates } from '@/i18n-config';
import { getSEOMetadata } from '@/lib/seo-metadata';
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

// Metadata will be handled inline using React 19 native approach

export default async function NewsPage(props: LocalePageProps<NewsParams>) {
  // Resolve params and searchParams
  const params = await props.params;
  const searchParams = await props.searchParams;

  // Extract and validate locale
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale;
  console.log('NewsPage: Using locale', locale);

  // Get SEO metadata for the news page
  const seoData = await getSEOMetadata(
    locale, 
    'news.list', 
    { 
      count: '12' // Default article count
    }
  );

  // Load translations for the current locale
  const translations = await loadTranslations(locale);

  const [initialArticles, categories] = await Promise.all([
    getInitialNews(),
    getNewsCategories(),
  ]);

  return (
    <>
      {/* React 19 Native Metadata */}
      <title>{seoData?.title || 'Ring Platform News & Updates'}</title>
      <meta name="description" content={seoData?.description || 'Stay updated with the latest news, announcements, and developments from Ring Platform and the decentralized ecosystem.'} />
      {seoData?.keywords && (
        <meta name="keywords" content={seoData.keywords.join(', ')} />
      )}
      {seoData?.canonical && (
        <link rel="canonical" href={seoData.canonical} />
      )}
      
      {/* OpenGraph metadata */}
      <meta property="og:title" content={seoData?.ogTitle || seoData?.title || 'Ring Platform News & Updates'} />
      <meta property="og:description" content={seoData?.ogDescription || seoData?.description || 'Stay updated with the latest news, announcements, and developments from Ring Platform and the decentralized ecosystem.'} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content={locale === 'uk' ? 'uk_UA' : 'en_US'} />
      <meta property="og:site_name" content="Ring Platform" />
      {seoData?.ogImage && (
        <meta property="og:image" content={seoData.ogImage} />
      )}
      
      {/* Twitter Card metadata */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@RingPlatform" />
      <meta name="twitter:title" content={seoData?.twitterTitle || seoData?.title || 'Ring Platform News & Updates'} />
      <meta name="twitter:description" content={seoData?.twitterDescription || seoData?.description || 'Stay updated with the latest news, announcements, and developments from Ring Platform and the decentralized ecosystem.'} />
      {seoData?.twitterImage && (
        <meta name="twitter:image" content={seoData.twitterImage} />
      )}
      
      {/* Hreflang alternates */}
      <link rel="alternate" hrefLang="en" href="/en/news" />
      <link rel="alternate" hrefLang="uk" href="/uk/news" />
      
      {/* Standard SEO metadata */}
      <meta name="robots" content="index, follow" />
      <meta name="author" content="Ring Platform" />

      {/* Perfect 3-Column Responsive Layout Wrapper */}
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
    </>
  );
} 