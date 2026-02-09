import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { ArticleEditor } from '@/features/news/components/article-editor';
import { LocalePageProps } from '@/utils/page-props';
import { isValidLocale, defaultLocale, loadTranslations } from '@/i18n-config';
import NewsWrapper from '@/components/wrappers/news-wrapper';
import { connection } from 'next/server'


export async function generateMetadata({ 
  params 
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  await connection() // Next.js 16: opt out of prerendering

  const { locale } = await params;
  const validLocale = isValidLocale(locale) ? locale : defaultLocale;
  const t = await loadTranslations(validLocale);

  return {
    title: `${t.modules.admin.createArticle} | Ring Platform`,
    description: 'Create a new news article',
    robots: 'noindex, nofollow',
  };
}

export default async function CreateArticlePage({ 
  params 
}: {
  params: Promise<{ locale: string }>
}) {
  await connection() // Next.js 16: opt out of prerendering

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
    <NewsWrapper pageContext="create" translations={t}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {t.modules.admin.createArticle}
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
    </NewsWrapper>
  );
} 