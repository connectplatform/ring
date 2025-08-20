import React from 'react';
import { Metadata } from 'next';
import { NewsList } from '@/features/news/components/news-list';
import { getNewsCollection, getNewsCategoriesCollection } from '@/lib/firestore-collections';
import { NewsArticle, NewsCategoryInfo } from '@/features/news/types';
import { LocalePageProps, LocaleMetadataProps } from '@/utils/page-props';
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates } from '@/i18n-config';
import { generatePageMetadata } from '@/utils/seo-metadata';

type NewsParams = {};

export const dynamic = 'force-dynamic';

async function getInitialNews(): Promise<NewsArticle[]> {
  try {
    const newsCollection = getNewsCollection();
    const snapshot = await newsCollection
      .where('status', '==', 'published')
      .where('visibility', 'in', ['public', 'subscriber'])
      .orderBy('publishedAt', 'desc')
      .limit(12)
      .get();
    
    return snapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.error('Error fetching initial news:', error);
    return [];
  }
}

async function getNewsCategories(): Promise<NewsCategoryInfo[]> {
  try {
    const categoriesCollection = getNewsCategoriesCollection();
    const snapshot = await categoriesCollection.orderBy('name', 'asc').get();
    
    return snapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.error('Error fetching news categories:', error);
    return [];
  }
}

export async function generateMetadata(props: LocaleMetadataProps<NewsParams>): Promise<Metadata> {
  try {
    const params = await props.params;

    // Extract and validate locale
    const locale = isValidLocale(params.locale) ? params.locale : defaultLocale;

    // Use the new SEO metadata utility
    const metadata = await generatePageMetadata(locale, 'news.list');
    
    // Generate hreflang alternates
    const pathname = `/news`;
    const alternates = generateHreflangAlternates(pathname);

    return {
      ...metadata,
      keywords: ['news', 'updates', 'announcements', 'ring platform', 'technology'],
      alternates: {
        languages: alternates
      }
    };
  } catch (error) {
    return {
      title: 'News & Updates | Ring Platform',
      description: 'Stay updated with the latest news, updates, and announcements from Ring Platform.',
      keywords: ['news', 'updates', 'announcements', 'ring platform', 'technology'],
    };
  }
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
  );
} 