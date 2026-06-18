import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { ROUTES } from '@/constants/routes';
import { db } from '@/lib/database';
import { NewsArticle } from '@/features/news/types';
import { AdminNewsManager } from '@/features/news/components/admin-news-manager';
import { NewsSubmissionsReady } from '@/features/news/components/news-submissions-ready';
import { mapNewsDocument } from '@/lib/news/map-news-document';
import { routing } from '@/i18n/routing';
import type { Locale } from '@/i18n/shared';
import { getTranslations } from 'next-intl/server';
import AdminWrapper from '@/components/wrappers/admin-wrapper';
import { buildModulesAdminLabels } from '@/features/admin/admin-labels';
import { isPlatformAdmin } from '@/features/auth/user-role';
import { connection } from 'next/server';

async function getNewsArticles(): Promise<NewsArticle[]> {
  try {
    const result = await db().queryDocs({
      collection: 'news',
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      pagination: { limit: 50 },
    });

    if (!result.success) {
      console.error('Error fetching news:', result.error);
      return [];
    }

    return result.data.map((doc) => mapNewsDocument(doc));
  } catch (error) {
    console.error('Error fetching news articles:', error);
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  await connection();

  const { locale } = await params;
  const validLocale: Locale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : (routing.defaultLocale as Locale);
  const t = await getTranslations('modules.admin');

  return {
    title: `${t('newsManagement')} | Ring Platform`,
    description: t('newsManagementDescription'),
  };
}

export default async function AdminNewsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await connection() // Next.js 16: opt out of prerendering

  const { locale } = await params;
  const validLocale: Locale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : (routing.defaultLocale as Locale);
  const t = await getTranslations('modules.admin');

  const session = await auth();

  if (!session?.user) {
    redirect(
      `${ROUTES.LOGIN(validLocale)}?callbackUrl=${encodeURIComponent(ROUTES.ADMIN_NEWS(validLocale))}`,
    );
  }

  if (!isPlatformAdmin(session.user.role)) {
    redirect(ROUTES.UNAUTHORIZED(validLocale));
  }

  const articles = await getNewsArticles();
  const adminLabels = buildModulesAdminLabels(t);

  return (
    <AdminWrapper locale={validLocale} pageContext="news" labels={adminLabels}>
      <div className="container mx-auto px-0 py-0">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-foreground">{t('newsManagement')}</h1>
          <p className="text-muted-foreground">{t('newsManagementDescription')}</p>
        </div>

        <NewsSubmissionsReady articles={articles} locale={validLocale} />

        <AdminNewsManager initialArticles={articles} locale={validLocale} />
      </div>
    </AdminWrapper>
  );
}
