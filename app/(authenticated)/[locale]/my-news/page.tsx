import React from 'react'
import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { isValidLocale, defaultLocale, loadTranslations } from '@/i18n-config'
import { getSEOMetadata } from '@/lib/seo-metadata'
import { MyNewsClient } from './my-news-client'
import NewsPageWrapper from '@/components/wrappers/news-page-wrapper'
import { connection } from 'next/server'

// Default category info for MyNews page
const defaultCategoryInfo: Record<string, { name: string; description: string; color: string; icon: string; articleCount: number }> = {
  'my-articles': {
    name: 'My Articles',
    description: 'Your published and draft articles',
    color: 'bg-green-500',
    icon: '📝',
    articleCount: 0
  }
}

type MyNewsParams = {}


export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  await connection() // Next.js 16: opt out of prerendering

  const { locale } = await params
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  const t = await loadTranslations(validLocale)

  return {
    title: `${t.news?.myNews || 'My News'} | Ring Platform`,
    description: t.news?.myNewsDescription || 'Manage your published articles and writing statistics'
  }
}

export default async function MyNewsPage({
  params
}: {
  params: Promise<{ locale: string }>
}) {
  await connection() // Next.js 16: opt out of prerendering

  const { locale } = await params
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  const t = await loadTranslations(validLocale)

  // Check authentication
  const session = await auth()

  if (!session?.user) {
    redirect(`/${validLocale}/login?callbackUrl=/${validLocale}/my-news`)
  }

  // Get SEO metadata
  const seoData = await getSEOMetadata(
    validLocale,
    'news.my-news',
    {
      author: session.user.name || 'Author'
    }
  )

  return (
    <>
      {/* React 19 Native Metadata */}
      <title>{seoData?.title || `${t.news?.myNews || 'My News'} | Ring Platform`}</title>
      <meta name="description" content={seoData?.description || (t.news?.myNewsDescription || 'Manage your published articles and writing statistics')} />
      {seoData?.keywords && (
        <meta name="keywords" content={seoData.keywords.join(', ')} />
      )}
      {seoData?.canonical && (
        <link rel="canonical" href={seoData.canonical} />
      )}

      {/* OpenGraph metadata */}
      <meta property="og:title" content={seoData?.ogTitle || seoData?.title || `${t.news?.myNews || 'My News'} | Ring Platform`} />
      <meta property="og:description" content={seoData?.ogDescription || seoData?.description || (t.news?.myNewsDescription || 'Manage your published articles and writing statistics')} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content={validLocale === 'uk' ? 'uk_UA' : 'en_US'} />
      <meta property="og:site_name" content="Ring Platform" />
      {seoData?.ogImage && (
        <meta property="og:image" content={seoData.ogImage} />
      )}

      {/* Twitter Card metadata */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@RingPlatform" />
      <meta name="twitter:title" content={seoData?.twitterTitle || seoData?.title || `${t.news?.myNews || 'My News'} | Ring Platform`} />
      <meta name="twitter:description" content={seoData?.twitterDescription || seoData?.description || (t.news?.myNewsDescription || 'Manage your published articles and writing statistics')} />
      {seoData?.twitterImage && (
        <meta property="twitter:image" content={seoData.twitterImage} />
      )}

      {/* Standard SEO metadata */}
      <meta name="robots" content="noindex, nofollow" />
      <meta name="author" content="Ring Platform" />

      <NewsPageWrapper locale={validLocale} translations={t} categoryInfo={defaultCategoryInfo}>
        {/* Content Header - Store Settings Style */}
        <div className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-sm mb-8">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{t.news?.myNews || 'My News'}</h1>
                <p className="text-muted-foreground">
                  {t.news?.myNewsDescription || 'Manage your published articles and writing statistics'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-6 max-w-7xl">
          <MyNewsClient
            userId={session.user.id}
            userName={session.user.name || 'Author'}
            locale={validLocale}
            translations={t}
          />
        </div>
      </NewsPageWrapper>
    </>
  )
}
