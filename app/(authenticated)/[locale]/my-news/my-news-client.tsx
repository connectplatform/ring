'use client'

import React, { useState, useEffect, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { NewsArticle, NewsStatus } from '@/features/news/types'
import { deleteArticle, getMyArticlesAction, getUserArticleStatsAction } from '@/app/_actions/news'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  AlertCircle
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import Link from 'next/link'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface MyNewsClientProps {
  userId: string
  userName: string
  locale: string
  translations: any
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

export function MyNewsClient({
  userId,
  userName,
  locale,
  translations
}: MyNewsClientProps) {
  const router = useRouter()

  // React 19 useTransition for non-blocking filter updates
  const [isPending, startTransition] = useTransition()

  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [stats, setStats] = useState<ArticleStats | null>(null)
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
        getUserArticleStatsAction(locale)
      ])

      if (articlesResult.success && articlesResult.data) {
        setArticles(articlesResult.data)
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
  }, [userId, filterStatus])

  // Load articles and stats
  useEffect(() => {
    loadData()
  }, [loadData])

  const handleDeleteArticle = async (articleId: string) => {
    if (!confirm('Are you sure you want to delete this article? This action cannot be undone.')) {
      return
    }

    setDeletingId(articleId)
    try {
      const result = await deleteArticle(articleId, locale)
      if (result.success) {
        // Remove from local state
        setArticles(prev => prev.filter(a => a.id !== articleId))
        // Refresh stats
        const statsResult = await getUserArticleStatsAction(locale)
        if (statsResult.success) {
          setStats(statsResult.stats)
        }
      } else {
        setError(result.error || 'Failed to delete article')
      }
    } catch (err) {
      setError('Failed to delete article')
    } finally {
      setDeletingId(null)
    }
  }

  const getStatusBadgeColor = (status: NewsStatus) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'draft': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'archived': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
      default: return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    }
  }

  const getStatusLabel = (status: NewsStatus) => {
    const labels = translations?.news?.status || {}
    return labels[status] || status.charAt(0).toUpperCase() + status.slice(1)
  }

  if (loading && !articles.length) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading your articles...</span>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Articles</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalArticles}</div>
              <p className="text-xs text-muted-foreground">
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
              <div className="text-2xl font-bold">{stats.totalViews.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
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
              <div className="text-2xl font-bold">{stats.totalLikes.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
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
              <div className="text-2xl font-bold">{stats.totalComments}</div>
              <p className="text-xs text-muted-foreground">
                Total comments
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Actions and Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => router.push(`/${locale}/admin/news/create`)}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            {translations?.news?.createArticle || 'Create Article'}
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <Select value={filterStatus} onValueChange={(value: NewsStatus | 'all') => startTransition(() => setFilterStatus(value))}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{translations?.news?.allStatuses || 'All Statuses'}</SelectItem>
              <SelectItem value="published">{getStatusLabel('published')}</SelectItem>
              <SelectItem value="draft">{getStatusLabel('draft')}</SelectItem>
              <SelectItem value="archived">{getStatusLabel('archived')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Articles List */}
      <div className="space-y-4">
        {articles.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {translations?.news?.noArticles || 'No articles yet'}
              </h3>
              <p className="text-muted-foreground text-center mb-4">
                {translations?.news?.noArticlesDescription || 'Start writing your first article to share your knowledge with the community.'}
              </p>
              <Button
                onClick={() => router.push(`/${locale}/admin/news/create`)}
                className="bg-primary hover:bg-primary/90"
              >
                <Plus className="h-4 w-4 mr-2" />
                {translations?.news?.createFirstArticle || 'Create Your First Article'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          articles.map((article) => (
            <Card key={article.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-xl font-semibold line-clamp-2 mb-2">
                        {article.title}
                      </h3>
                      <Badge className={getStatusBadgeColor(article.status)}>
                        {getStatusLabel(article.status)}
                      </Badge>
                    </div>

                    <p className="text-muted-foreground line-clamp-3 mb-4">
                      {article.excerpt}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {article.publishedAt
                            ? formatDistanceToNow(
                                article.publishedAt instanceof Date ? article.publishedAt :
                                (article.publishedAt as any).toDate ? (article.publishedAt as any).toDate() :
                                new Date(article.publishedAt as any),
                                { addSuffix: true }
                              )
                            : formatDistanceToNow(
                                article.createdAt instanceof Date ? article.createdAt :
                                (article.createdAt as any).toDate ? (article.createdAt as any).toDate() :
                                new Date(article.createdAt as any),
                                { addSuffix: true }
                              )
                          }
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
                        {article.category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 lg:flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <Link href={`/${locale}/news/${article.slug}`}>
                        <Eye className="h-4 w-4 mr-2" />
                        {translations?.common?.view || 'View'}
                      </Link>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <Link href={`/${locale}/admin/news/edit/${article.id}`}>
                        <Edit className="h-4 w-4 mr-2" />
                        {translations?.common?.edit || 'Edit'}
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

      {/* Most Viewed Article */}
      {stats?.mostViewedArticle && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {translations?.news?.mostViewedArticle || 'Most Viewed Article'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <h4 className="font-semibold mb-1">{stats.mostViewedArticle.title}</h4>
                <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                  {stats.mostViewedArticle.excerpt}
                </p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{stats.mostViewedArticle.views || 0} views</span>
                  <span>{stats.mostViewedArticle.likes || 0} likes</span>
                  <Badge variant="outline" className="text-xs">
                    {stats.mostViewedArticle.category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Badge>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/${locale}/news/${stats.mostViewedArticle.slug}`}>
                  <Eye className="h-4 w-4 mr-2" />
                  {translations?.common?.view || 'View'}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
