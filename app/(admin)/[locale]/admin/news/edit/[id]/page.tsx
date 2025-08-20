import React from 'react';
import { Metadata } from 'next';
import { redirect, notFound } from 'next/navigation';
import { auth } from '@/auth';
import { getNewsCollection } from '@/lib/firestore-collections';
import { NewsArticle } from '@/features/news/types';
import { ArticleEditor } from '@/features/news/components/article-editor';
import { isValidLocale, defaultLocale, loadTranslations } from '@/i18n-config';

export const dynamic = 'force-dynamic';

async function getArticle(id: string): Promise<NewsArticle | null> {
  try {
    const newsCollection = getNewsCollection();
    const doc = await newsCollection.doc(id).get();
    
    if (!doc.exists) {
      return null;
    }
    
    return {
      id: doc.id,
      ...doc.data()
    } as NewsArticle;
  } catch (error) {
    console.error('Error fetching article:', error);
    return null;
  }
}

export async function generateMetadata({ 
  params 
}: {
  params: Promise<{ locale: string; id: string }>
}): Promise<Metadata> {
  const { locale, id } = await params;
  const validLocale = isValidLocale(locale) ? locale : defaultLocale;
  const t = await loadTranslations(validLocale);
  
  const article = await getArticle(id);

  return {
    title: `${t.news.editArticle}: ${article?.title || 'Article'} | Ring Platform`,
    description: `Edit article: ${article?.title || 'Unknown article'}`,
    robots: 'noindex, nofollow',
  };
}

export default async function EditArticlePage({ 
  params 
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params;
  const validLocale = isValidLocale(locale) ? locale : defaultLocale;
  const t = await loadTranslations(validLocale);
  
  // Check authentication and admin role
  const session = await auth();
  
  if (!session?.user) {
    redirect(`/${validLocale}/login?callbackUrl=/${validLocale}/admin/news/edit/${id}`);
  }

  // TODO: Implement proper role checking
  
  const article = await getArticle(id);
  
  if (!article) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {t.news.editArticle}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Edit article: {article.title}
        </p>
      </div>

      <ArticleEditor 
        mode="edit"
        article={article}
        locale={validLocale}
        translations={t}
      />
    </div>
  );
} 