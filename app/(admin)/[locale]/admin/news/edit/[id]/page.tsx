import React from 'react';
import { getRingSeoBranding } from '@/lib/ring-config'
import { Metadata } from 'next';
import { redirect, notFound } from 'next/navigation';
import { auth } from '@/auth'
import { ROUTES } from '@/constants/routes' 
import { db } from '@/lib/database';
import { mapNewsDocument } from '@/lib/news/map-news-document';
import { NewsArticle } from '@/features/news/types';
import { ArticleEditor } from '@/features/news/components/article-editor';
import type { Locale } from '@/i18n/shared';
import { routing } from '@/i18n/routing';
import { getTranslations } from 'next-intl/server';
;
import NewsWrapper from '@/components/wrappers/news-wrapper';
import { connection } from 'next/server'

/**
 * Get article by ID - Server Component async/await (React 19)
 */
async function getArticle(id: string): Promise<NewsArticle | null> {
  try {
    const result = await db().readDoc('news', id)

    if (!result.success || !result.data) {
      return null
    }

    return mapNewsDocument(result.data)
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
  await connection() // Next.js 16: opt out of prerendering

  const { locale, id } = await params;
  const validLocale: Locale = routing.locales.includes(locale as Locale) ? (locale as Locale) : (routing.defaultLocale as Locale);
  const t = await getTranslations('modules.admin');
  
  const article = await getArticle(id);

  return {
    title: `${t('createArticle')} | ${getRingSeoBranding().siteName}`,
    description: article?.title ? `Edit article: ${article.title}` : 'Edit article'
  };
}

export default async function EditArticlePage({ 
  params 
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  await connection() // Next.js 16: opt out of prerendering

  const { locale, id } = await params;
  const validLocale: Locale = routing.locales.includes(locale as Locale) ? (locale as Locale) : (routing.defaultLocale as Locale);
  const t = await getTranslations('modules.admin');
  
  // Check authentication and admin role
  const session = await auth();
  
  if (!session?.user) {
    redirect(ROUTES.LOGIN(validLocale) + `?callbackUrl=${encodeURIComponent(ROUTES.ADMIN_NEWS_EDIT(id, validLocale))}`);
  }

  // TODO: Implement proper role checking
  
  const article = await getArticle(id);
  
  if (!article) {
    notFound();
  }

  return (
    <NewsWrapper pageContext="edit" >
      <div className="container mx-auto px-0 py-0">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t('createArticle')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Edit article: {article.title}
          </p>
        </div>

        <ArticleEditor 
          mode="edit"
          article={article}
          locale={validLocale}
        />
      </div>
    </NewsWrapper>
  );
} 