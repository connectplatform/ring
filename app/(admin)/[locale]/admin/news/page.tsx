import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth'
import { ROUTES } from '@/constants/routes'
import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService';
import { NewsArticle } from '@/features/news/types';
import { AdminNewsManager } from '@/features/news/components/admin-news-manager';
import { NewsSubmissionsReady } from '@/features/news/components/news-submissions-ready';
import { mapNewsDocument } from '@/lib/news/map-news-document';
import { routing } from '@/i18n/routing';
import type { Locale } from '@/i18n/shared';
import { getTranslations } from 'next-intl/server';
import NewsWrapper from '@/components/wrappers/news-wrapper';
import { connection } from 'next/server'


/**
 * Get news articles for admin
 * Server Component - native async/await (React 19 pattern)
 */
async function getNewsArticles(): Promise<NewsArticle[]> {
  try {
    // Initialize database service with proper error handling
    const initResult = await initializeDatabase()
    if (!initResult.success) {
      console.error('Database initialization failed:', initResult.error)
      return [] // Graceful degradation
    }
    const db = getDatabaseService()
    
    const result = await db.query({
      collection: 'news',
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      pagination: { limit: 50 }
    });
    
    if (!result.success) {
      console.error('Error fetching news:', result.error)
      return []
    }
    
    return result.data.map((doc) =>
      mapNewsDocument(doc as { id: string; data?: Record<string, unknown> })
    );
  } catch (error) {
    console.error('Error fetching news articles:', error);
    return [];
  }
}

export async function generateMetadata({ 
  params 
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  await connection() // Next.js 16: opt out of prerendering

  const { locale } = await params;
  const t = await getTranslations('modules.admin');

  return {
    title: `${t('newsManagement')} | Zemna AI`,
    description: t('newsManagementDescription')
  };
}

export default async function AdminNewsPage({
  params
}: {
  params: Promise<{ locale: string }>
}) {
  await connection() // Next.js 16: opt out of prerendering

  const startTime = Date.now();
  const { locale } = await params;
  const validLocale: Locale = routing.locales.includes(locale as Locale) ? (locale as Locale) : (routing.defaultLocale as Locale);
  const t = await getTranslations('modules.admin');
  
  // Check authentication and admin role
  const session = await auth();
  
  if (!session?.user) {
    redirect(ROUTES.LOGIN(validLocale) + `?callbackUrl=${encodeURIComponent(ROUTES.ADMIN_NEWS(validLocale))}`);
  }

  // Check if user has admin role (simplified check for now)
  // TODO: Implement proper role checking
  
  const articles = await getNewsArticles();

  return (
    <NewsWrapper
      pageContext="articles"
      stats={{ totalArticles: articles.length, publishedArticles: 0, draftArticles: 0, recentViews: 0 }}
    >
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
        {t('newsManagement')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
        {t('newsManagementDescription')}
        </p>
      </div>

      <NewsSubmissionsReady articles={articles} locale={validLocale} />

      <AdminNewsManager
        initialArticles={articles}
        locale={validLocale}
      />
    </NewsWrapper>
  );

  // Performance monitoring
  const endTime = Date.now();
  const duration = endTime - startTime;
  console.log(`AdminNewsPage render time: ${duration}ms`);
}