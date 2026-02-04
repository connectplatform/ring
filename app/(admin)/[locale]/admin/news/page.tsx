import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth'
import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService';
import { NewsArticle } from '@/features/news/types';
import { AdminNewsManager } from '@/features/news/components/admin-news-manager';
import { isValidLocale, defaultLocale, loadTranslations } from '@/i18n-config';
import NewsWrapper from '@/components/wrappers/news-wrapper';

// Allow caching for admin news management with short revalidation for content management data
export const dynamic = "auto"
export const revalidate = 60 // 1 minute for news management data

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
    
    return result.data.map(doc => ({
      id: doc.id,
      ...doc
    })) as any[] as NewsArticle[];
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
  const { locale } = await params;
  const validLocale = isValidLocale(locale) ? locale : defaultLocale;
  const t = await loadTranslations(validLocale);

  return {
    title: `${t.modules.admin.newsManagement} | Ring Platform`,
    description: t.modules.admin.newsManagementDescription
  };
}

export default async function AdminNewsPage({ 
  params 
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params;
  const validLocale = isValidLocale(locale) ? locale : defaultLocale;
  const t = await loadTranslations(validLocale);
  
  // Check authentication and admin role
  const session = await auth();
  
  if (!session?.user) {
    redirect(`/${validLocale}/login?callbackUrl=/${validLocale}/admin/news`);
  }

  // Check if user has admin role (simplified check for now)
  // TODO: Implement proper role checking
  
  const articles = await getNewsArticles();

  return (
    <NewsWrapper pageContext="articles" stats={{ totalArticles: articles.length, publishedArticles: 0, draftArticles: 0, recentViews: 0 }}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
        {t.modules.admin.newsManagement}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
        {t.modules.admin.newsManagementDescription}
        </p>
      </div>

      <AdminNewsManager
        initialArticles={articles}
        locale={validLocale}
        translations={t}
      />
    </NewsWrapper>
  );
} 