import type { Metadata } from 'next'
import Link from 'next/link'
import { setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { isValidLocale, defaultLocale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { ROUTES } from '@/constants/routes'
import NewsPageWrapper from '@/components/wrappers/news-page-wrapper'
import { loadTranslations } from '@/i18n/load-translations'
import { getCategories } from '@/features/news/services/news-category-service'
import { PLATFORM_CATEGORY_INFO } from '@/features/news/lib/platform-category-info'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LocalePageProps } from '@/utils/page-props'

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
  return buildLocalizedMetadata({
    locale,
    path: 'news.categoriesIndex',
    pathname: '/news/categories',
  })
}

export default async function NewsCategoriesPage(props: LocalePageProps) {
  const params = await props.params
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale
  const translations = await loadTranslations(locale)
  const dbCategories = await getCategories()

  const cards =
    dbCategories.length > 0
      ? dbCategories.map((row) => ({
          slug: row.slug || row.id,
          name: row.name,
          description: row.description,
          color: row.color || 'bg-muted',
          icon: row.icon || '📰',
        }))
      : Object.entries(PLATFORM_CATEGORY_INFO).map(([slug, info]) => ({
          slug,
          name: info.name,
          description: info.description,
          color: info.color,
          icon: info.icon,
        }))

  return (
    <NewsPageWrapper locale={locale} categoryInfo={PLATFORM_CATEGORY_INFO} translations={translations}>
      <div className="container mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold mb-2">
          {translations.news?.allCategories || 'All Categories'}
        </h1>
        <p className="text-muted-foreground mb-8 max-w-2xl">
          {translations.news?.description ||
            'Browse news by topic. Open a category to read its published articles.'}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => (
            <Card key={card.slug} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <span className="text-2xl" aria-hidden>
                    {card.icon}
                  </span>
                  <span>
                    {translations.news?.categories?.[card.slug] || card.name}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {card.description ? (
                  <p className="text-sm text-muted-foreground mb-4">{card.description}</p>
                ) : null}
                <Button variant="outline" size="sm" asChild>
                  <Link href={ROUTES.NEWS_CATEGORY(card.slug, locale)}>View articles</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </NewsPageWrapper>
  )
}
