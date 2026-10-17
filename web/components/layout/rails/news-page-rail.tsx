'use client'

/**
 * NEWS PAGE RAIL - Extracted right-rail content
 * ==============================================
 * Trending articles, newsletter subscription, RSS feeds, upcoming events,
 * and help resources for the public news listing page.
 * Used by news-page-wrapper via RingRightRailLayout (railWidth={300}).
 */

import React from 'react'
import { useRouter } from 'next/navigation'
import {
  Rss,
  TrendingUp,
  Bell,
  BookOpen,
  Calendar,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export interface NewsPageRailProps {
  locale: string
  categoryInfo: Record<string, { name: string; description?: string; color?: string; icon?: string; articleCount?: number }>
  translations?: Record<string, any>
  onNavigate?: () => void
}

export function NewsPageRail({ locale, categoryInfo, translations = {}, onNavigate }: NewsPageRailProps) {
  const router = useRouter()
  const t = useTranslations('modules.news')

  const navigate = (href: string) => {
    router.push(href)
    onNavigate?.()
  }

  return (
    <div className="space-y-6">
      {/* Trending Articles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {t('sidebar.trending')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t('sidebar.popularThisWeek')}
          </p>
          {/* TODO: Implement trending articles */}
        </CardContent>
      </Card>

      {/* Newsletter Subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            {t('sidebar.newsletter')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t('sidebar.newsletterDescription')}
          </p>
          <Button className="w-full" variant="default">
            {t('sidebar.subscribe')}
          </Button>
        </CardContent>
      </Card>

      {/* RSS Feeds */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Rss className="h-4 w-4" />
            {t('sidebar.rssFeeds')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <a
            href="/api/news/rss"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            <Rss className="h-4 w-4" />
            {t('sidebar.allNews')}
          </a>
          {Object.keys(categoryInfo).slice(0, 4).map((key) => (
            <a
              key={key}
              href={`/api/news/rss?category=${key}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              <Rss className="h-4 w-4" />
              {t.has(`categories.${key}` as 'categories.other')
                ? t(`categories.${key}` as 'categories.other')
                : translations.news?.categories?.[key] || categoryInfo[key].name}
            </a>
          ))}
        </CardContent>
      </Card>

      {/* Upcoming Events */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {t('sidebar.upcomingEvents')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t('sidebar.upcomingEventsDescription')}
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate(`/${locale}/news/category/events`)}
          >
            {t('sidebar.viewEvents')}
          </Button>
        </CardContent>
      </Card>

      {/* Help & Documentation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            {t('sidebar.helpResources')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{t('sidebar.helpResourcesDescription')}</p>
          <Button
            variant="link"
            className="p-0 h-auto"
            onClick={() => navigate(`/${locale}/docs`)}
          >
            {t('sidebar.viewDocumentation')} →
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
