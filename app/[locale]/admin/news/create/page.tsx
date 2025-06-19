import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { ArticleEditor } from '@/features/news/components/ArticleEditor';
import { LocalePageProps } from '@/utils/page-props';
import { isValidLocale, defaultLocale, loadTranslations } from '@/utils/i18n-server';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ 
  params 
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params;
  const validLocale = isValidLocale(locale) ? locale : defaultLocale;
  const t = await loadTranslations(validLocale);

  return {
    title: `${t.news.createArticle} | Ring Platform`,
    description: 'Create a new news article',
    robots: 'noindex, nofollow',
  };
}

export default async function CreateArticlePage({ 
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
    redirect(`/${validLocale}/login?callbackUrl=/${validLocale}/admin/news/create`);
  }

  // TODO: Implement proper role checking
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {t.news.createArticle}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Create a new article for the Ring Platform news section
        </p>
      </div>

      <ArticleEditor 
        mode="create"
        locale={validLocale}
        translations={t}
      />
    </div>
  );
} 