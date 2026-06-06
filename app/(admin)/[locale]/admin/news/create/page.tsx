import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { ROUTES } from '@/constants/routes';
import { ArticleEditor } from '@/features/news/components/article-editor';
import type { Locale } from '@/i18n/shared';
import NewsWrapper from '@/components/wrappers/news-wrapper';
import { connection } from 'next/server'
import { routing } from '@/i18n/routing';
import { getTranslations } from 'next-intl/server';


export async function generateMetadata({ 
  params 
}: {
  params: Promise<{ locale: Locale }>
}): Promise<Metadata> {
  await connection() // Next.js 16: opt out of prerendering

  const { locale } = await params;
  const validLocale = routing.locales.includes(locale as Locale) ? locale : routing.defaultLocale;
  const t = await getTranslations('modules.admin');

  return {
    title: `${t('createArticle')} | Ring Platform`,
    description: t('newsManagementDescription'),
    robots: 'noindex, nofollow',
  };
}

export default async function CreateArticlePage({ 
  params 
}: {
  params: Promise<{ locale: Locale }>
}) {
  await connection() // Next.js 16: opt out of prerendering

  const { locale } = await params;
  const validLocale = routing.locales.includes(locale as Locale) ? locale : routing.defaultLocale;
  const t = await getTranslations('modules.admin');
  
  // Check authentication and admin role
  const session = await auth();
  
  if (!session?.user) {
    redirect(ROUTES.LOGIN(validLocale) + `?callbackUrl=${encodeURIComponent(ROUTES.ADMIN_NEWS_CREATE(validLocale))}`);
  }

  // TODO: Implement proper role checking
  
  return (
    <NewsWrapper pageContext="create">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {t('createArticle')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t('newsManagementDescription')}
        </p>
      </div>

      <ArticleEditor
        mode="create"
        locale={validLocale}
      />
    </NewsWrapper>
  );
} 