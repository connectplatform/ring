import React from 'react';
import { Metadata } from 'next';
import { NewsList } from '@/features/news/components/news-list';
import { getCachedNewsCollection, getCachedNewsCategoriesCollection } from '@/lib/services/firebase-service-manager';
import { NewsArticle, NewsCategoryInfo } from '@/features/news/types';
import { LocalePageProps, LocaleMetadataProps } from '@/utils/page-props';
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates } from '@/i18n-config';
import { getSEOMetadata } from '@/lib/seo-metadata';

type NewsParams = {};

export const dynamic = 'force-dynamic';

async function getInitialNews(): Promise<NewsArticle[]> {
  try {
    const snapshot = await getCachedNewsCollection({
      where: [
        { field: 'status', operator: '==', value: 'published' },
        { field: 'visibility', operator: 'in', value: ['public', 'subscriber'] }
      ],
      orderBy: [{ field: 'publishedAt', direction: 'desc' }],
      limit: 12
    });
    
    return snapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.error('Error fetching initial news:', error);
    return [];
  }
}

async function getNewsCategories(): Promise<NewsCategoryInfo[]> {
  try {
    const snapshot = await getCachedNewsCategoriesCollection({
      orderBy: { field: 'name', direction: 'asc' }
    });
    
    return snapshot.docs.map(doc => doc.data());
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

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">
            {translations.news?.title || 'News & Updates'}
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl">
            {translations.news?.description || 'Stay informed with the latest news, platform updates, partnership announcements, and community highlights from Ring Platform.'}
          </p>
        </div>

        {/* Featured Articles Section */}
        {initialArticles.some(article => article.featured) && (
          <div className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">
              {translations.news?.featuredStories || 'Featured Stories'}
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {initialArticles
                .filter(article => article.featured)
                .slice(0, 2)
                .map((article) => (
                  <div key={article.id} className="lg:col-span-1">
                    <div className="bg-card rounded-lg border p-6 hover:shadow-lg transition-shadow">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded">
                          {translations.news?.featured || 'Featured'}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {article.category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </div>
                      <h3 className="text-xl font-semibold mb-2 line-clamp-2">
                        {article.title}
                      </h3>
                      <p className="text-muted-foreground mb-4 line-clamp-3">
                        {article.excerpt}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {translations.news?.byAuthor || 'By'} {article.authorName}
                        </span>
                        <a 
                          href={`/${locale}/news/${article.slug}`}
                          className="text-primary hover:underline font-medium"
                        >
                          {translations.news?.readMore || 'Read more'} →
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* All Articles */}
        <div>
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
    </>
  );
} 