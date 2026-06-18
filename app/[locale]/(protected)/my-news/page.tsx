import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { auth } from '@/auth'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { MyNewsClient } from './my-news-client'
import NewsPageWrapper from '@/components/wrappers/news-page-wrapper'
import { connection } from 'next/server'
import { logger } from '@/lib/logger'

const defaultCategoryInfo: Record<
  string,
  { name: string; description: string; color: string; icon: string; articleCount: number }
> = {
  'my-articles': {
    name: 'My Articles',
    description: 'Your published and draft articles',
    color: 'bg-green-500',
    icon: '📝',
    articleCount: 0,
  },
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  const t = await getTranslations('news.my-news')
  return {
    title: t('title'),
    description: t('description'),
    robots: { index: false, follow: false },
  }
}

export default async function MyNewsPage({ params }: { params: Promise<{ locale: string }> }) {
  await connection()

  const { locale } = await params
  const validLocale: Locale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : (routing.defaultLocale as Locale)

  const headersList = await headers()
  logger.info('MyNewsPage: Request details', {
    locale: validLocale,
    userAgent: headersList.get('user-agent'),
  })

  const session = await auth()
  if (!session?.user) return null

  try {
    const { userMigrationService } = await import('@/features/auth/services/user-migration')
    const userExists = await userMigrationService.userDocumentExists(session.user.id)
    if (!userExists) {
      await userMigrationService.ensureUserDocument(session.user as Parameters<
        typeof userMigrationService.ensureUserDocument
      >[0])
    }
  } catch (migrationError) {
    logger.error('MyNewsPage: Failed to check/create user document:', migrationError)
  }

  const t = await getTranslations('news.my-news')

  return (
    <NewsPageWrapper locale={validLocale} categoryInfo={defaultCategoryInfo}>
      <div className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-sm mb-8">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
              <p className="text-muted-foreground">{t('description')}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="container mx-auto px-6 max-w-7xl">
        <MyNewsClient
          userId={session.user.id}
          userName={session.user.name || 'Author'}
          locale={validLocale}
        />
      </div>
    </NewsPageWrapper>
  )
}
