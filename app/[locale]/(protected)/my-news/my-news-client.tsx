'use client'

import React, { useState, useEffect, useCallback, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { NewsArticle, NewsStatus } from '@/features/news/types'
import { deleteArticle, getMyArticlesAction, getUserArticleStatsAction } from '@/app/_actions/news'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useLocale, useTranslations } from 'next-intl'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  TrendingUp,
  FileText,
  Calendar,
  BarChart3,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { NewsPromotionPanel } from '@/features/news/components/news-promotion-panel'
import MyNewsWrapper from '@/components/wrappers/my-news-wrapper'
import {
  buildVisitWeekComparison,
  buildWeeklyVisitTotals,
} from '@/features/news/lib/visit-week-comparison'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface MyNewsClientProps {
  userId: string
  userName: string
  locale?: Locale
  title: string
  description: string
  blogUsername?: string | null
  siteBaseUrl?: string
}

interface ArticleStats {
  totalArticles: number
  publishedArticles: number
  draftArticles: number
  archivedArticles: number
  totalViews: number
  totalLikes: number
  totalComments: number
  averageViews: number
  averageLikes: number
  mostViewedArticle: NewsArticle | null
  recentActivity: {
    date: string
    articles: number
    views: number
    likes: number
  }[]
}

const tooltipStyle = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '6px',
  fontSize: '12px',
}

export function MyNewsClient({
  userId: _userId,
  userName,
  locale: localeProp,
  title,
  description,
  blogUsername = null,
  siteBaseUrl = '',
}: MyNewsClientProps) {
  const router = useRouter()
  const localeFromHook = useLocale() as Locale
  const locale = localeProp ?? localeFromHook
  const t = useTranslations('news')
  const tr = (key: string, fallback: string) => {
    try {
      return t(key as any)
    } catch {
      return fallback
    }
  }

  const [isPending, startTransition] = useTransition()

  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [stats, setStats] = useState<ArticleStats | null>(null)
  const [pendingRevisionCounts, setPendingRevisionCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<NewsStatus | 'all'>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [articlesResult, statsResult] = await Promise.all([
        getMyArticlesAction(locale, { status: filterStatus === 'all' ? undefined : filterStatus }),
        getUserArticleStatsAction(locale),
      ])

      if (articlesResult.success && articlesResult.data) {
        setArticles(articlesResult.data)
        // Batch pending-revision counts for author badge
        const counts: Record<string, number> = {}
        await Promise.all(
          articlesResult.data.map(async (article) => {
            try {
              const res = await fetch(
                `/api/news/${article.id}/revisions?status=pending-revision`,
              )
              const data = await res.json()
              if (res.ok && data.success && Array.isArray(data.data)) {
                counts[article.id] = data.data.length
              }
            } catch {
              /* ignore per-article count failures */
            }
          }),
        )
        setPendingRevisionCounts(counts)
      } else {
        setError(articlesResult.error || 'Failed to load articles')
      }

      if (statsResult.success && statsResult.stats) {
        setStats(statsResult.stats)
      }
    } catch (err) {
      setError('Failed to load data')
      console.error('Error loading my news data:', err)
    } finally {
      setLoading(false)
    }
  }, [filterStatus, locale])

  useEffect(() => {
    loadData()
  }, [loadData])

  const weekComparison = useMemo(
    () => buildVisitWeekComparison(stats?.recentActivity ?? []),
    [stats?.recentActivity],
  )
  const weeklyTotals = useMemo(
    () => buildWeeklyVisitTotals(stats?.recentActivity ?? []),
    [stats?.recentActivity],
  )

  const handleDeleteArticle = async (articleId: string) => {
    if (!confirm('Are you sure you want to delete this article? This action cannot be undone.')) {
      return
    }

    setDeletingId(articleId)
    try {
      const result = await deleteArticle(articleId, locale)
      if (result.success) {
        setArticles((prev) => prev.filter((a) => a.id !== articleId))
        const statsResult = await getUserArticleStatsAction(locale)
        if (statsResult.success) {
          setStats(statsResult.stats)
        }
      } else {
        setError(result.error || 'Failed to delete article')
      }
    } catch {
      setError('Failed to delete article')
    } finally {
      setDeletingId(null)
    }
  }

  const getStatusBadgeColor = (status: NewsStatus) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'draft':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'archived':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    }
  }

  const getStatusLabel = (status: NewsStatus) => {
    try {
      return t(`status.${status}` as any)
    } catch {
      return status.charAt(0).toUpperCase() + status.slice(1)
    }
  }

  const railStats = stats
    ? {
        totalArticles: stats.totalArticles,
        totalViews: stats.totalViews,
        totalLikes: stats.totalLikes,
        totalComments: stats.totalComments,
      }
    : null

  return (
    <MyNewsWrapper
      locale={locale}
      title={title}
      description={description}
      userName={userName}
      blogUsername={blogUsername}
      siteBaseUrl={siteBaseUrl}
      stats={railStats}
    >
      {loading && !articles.length ? (
        <div className="flex min-h-80 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading your articles…
        </div>
      ) : (
        <div className="space-y-6">
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {stats ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Articles</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tabular-nums">{stats.totalArticles}</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stats.publishedArticles} published, {stats.draftArticles} drafts
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Views</CardTitle>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tabular-nums">
                    {stats.totalViews.toLocaleString()}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Avg {stats.averageViews} per article
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Likes</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tabular-nums">
                    {stats.totalLikes.toLocaleString()}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Avg {stats.averageLikes} per article
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Engagement</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tabular-nums">{stats.totalComments}</div>
                  <p className="mt-1 text-xs text-muted-foreground">Total comments</p>
                </CardContent>
              </Card>
            </div>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Visits by weekday</CardTitle>
                <CardDescription>
                  This week vs the same weekday four weeks ago (article view activity).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={weekComparison}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="weekday" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="thisWeek"
                      name="This week"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="fourWeeksAgo"
                      name="4 weeks ago"
                      stroke="#94a3b8"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Weekly visit totals</CardTitle>
                <CardDescription>Rolling four-week view volume comparison.</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={weeklyTotals}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="weekLabel" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="views" name="Views" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <Button
              onClick={() => router.push(ROUTES.NEWS_CREATE(locale))}
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              {tr('createArticle', 'Create Article')}
            </Button>
            <Select
              value={filterStatus}
              onValueChange={(value: NewsStatus | 'all') =>
                startTransition(() => setFilterStatus(value))
              }
            >
              <SelectTrigger className={`w-[180px] ${isPending ? 'opacity-70' : ''}`}>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tr('allStatuses', 'All Statuses')}</SelectItem>
                <SelectItem value="published">{getStatusLabel('published')}</SelectItem>
                <SelectItem value="draft">{getStatusLabel('draft')}</SelectItem>
                <SelectItem value="archived">{getStatusLabel('archived')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            {articles.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="mb-2 text-lg font-semibold">
                    {tr('noArticles', 'No articles yet')}
                  </h3>
                  <p className="mb-4 text-center text-muted-foreground">
                    {tr(
                      'noArticlesDescription',
                      'Start writing your first article to share your knowledge with the community.',
                    )}
                  </p>
                  <Button
                    onClick={() => router.push(ROUTES.NEWS_CREATE(locale))}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {tr('createFirstArticle', 'Create Your First Article')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              articles.map((article) => (
                <Card key={article.id} className="transition-shadow hover:shadow-md">
                  <CardContent className="p-6">
                    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-start justify-between">
                          <h3 className="mb-2 line-clamp-2 text-xl font-semibold">
                            {article.title}
                          </h3>
                          <Badge className={getStatusBadgeColor(article.status)}>
                            {getStatusLabel(article.status)}
                          </Badge>
                        </div>

                        <p className="mb-4 line-clamp-3 text-muted-foreground">{article.excerpt}</p>

                        <div className="mb-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {article.publishedAt
                                ? formatDistanceToNow(
                                    article.publishedAt instanceof Date
                                      ? article.publishedAt
                                      : (article.publishedAt as any).toDate
                                        ? (article.publishedAt as any).toDate()
                                        : new Date(article.publishedAt as any),
                                    { addSuffix: true },
                                  )
                                : formatDistanceToNow(
                                    article.createdAt instanceof Date
                                      ? article.createdAt
                                      : (article.createdAt as any).toDate
                                        ? (article.createdAt as any).toDate()
                                        : new Date(article.createdAt as any),
                                    { addSuffix: true },
                                  )}
                            </span>
                          </div>

                          {article.views !== undefined && (
                            <div className="flex items-center gap-1">
                              <Eye className="h-4 w-4" />
                              <span>{article.views} views</span>
                            </div>
                          )}

                          {article.likes !== undefined && (
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-4 w-4" />
                              <span>{article.likes} likes</span>
                            </div>
                          )}

                          <Badge variant="outline" className="text-xs">
                            {article.category
                              .replace('-', ' ')
                              .replace(/\b\w/g, (l) => l.toUpperCase())}
                          </Badge>
                        </div>

                        <NewsPromotionPanel article={article} />
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:flex-shrink-0">
                        {(pendingRevisionCounts[article.id] ?? 0) > 0 ? (
                          <Button variant="secondary" size="sm" asChild>
                            <Link href={ROUTES.MY_NEWS_AMENDMENTS(article.id, locale)}>
                              {t('amendments.badge', {
                                count: pendingRevisionCounts[article.id],
                              })}
                            </Link>
                          </Button>
                        ) : null}

                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/${locale}/news/${article.slug}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            {tr('view', 'View')}
                          </Link>
                        </Button>

                        <Button variant="outline" size="sm" asChild>
                          <Link href={ROUTES.NEWS_EDIT(article.id, locale)}>
                            <Edit className="mr-2 h-4 w-4" />
                            {tr('edit', 'Edit')}
                          </Link>
                        </Button>

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteArticle(article.id)}
                          disabled={deletingId === article.id}
                        >
                          {deletingId === article.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {stats?.mostViewedArticle ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {tr('mostViewedArticle', 'Most Viewed Article')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <h4 className="mb-1 font-semibold">{stats.mostViewedArticle.title}</h4>
                    <p className="mb-2 line-clamp-2 text-sm text-muted-foreground">
                      {stats.mostViewedArticle.excerpt}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{stats.mostViewedArticle.views || 0} views</span>
                      <span>{stats.mostViewedArticle.likes || 0} likes</span>
                      <Badge variant="outline" className="text-xs">
                        {stats.mostViewedArticle.category
                          .replace('-', ' ')
                          .replace(/\b\w/g, (l) => l.toUpperCase())}
                      </Badge>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/${locale}/news/${stats.mostViewedArticle.slug}`}>
                      <Eye className="mr-2 h-4 w-4" />
                      {tr('view', 'View')}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </MyNewsWrapper>
  )
}
