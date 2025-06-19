import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getNewsCollection } from '@/lib/firestore-collections';
import { NewsArticle } from '@/features/news/types';
import { AdminNewsManager } from '@/features/news/components/AdminNewsManager';
import { LocalePageProps, LocaleMetadataProps } from '@/utils/page-props';
import { isValidLocale, defaultLocale, loadTranslations } from '@/utils/i18n-server';

type AdminNewsParams = {};

export const dynamic = 'force-dynamic';

async function getNewsArticles(): Promise<NewsArticle[]> {
  try {
    const newsCollection = getNewsCollection();
    const snapshot = await newsCollection
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as NewsArticle[];
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
    title: `${t.admin.newsManagement} | Ring Platform`,
    description: t.admin.newsManagementDescription,
    robots: 'noindex, nofollow', // Admin pages should not be indexed
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
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        {t.admin.newsManagement}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
        {t.admin.newsManagementDescription}
        </p>
      </div>

      <AdminNewsManager 
        initialArticles={articles}
        locale={validLocale}
        translations={t}
      />
    </div>
  );
} 