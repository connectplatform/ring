'use client'

import React, { useState } from 'react'
import { NewsAnalytics, NewsArticle } from '@/features/news/types'
import type { NewsWebVitalsSummary } from '@/features/news/services/get-news-web-vitals'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  Heart, 
  MessageCircle, 
  FileText,
  Calendar,
  PieChart as PieChartIcon,
  Target,
  Award,
  Zap
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import Link from 'next/link'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface NewsAnalyticsDashboardProps {
  analytics: NewsAnalytics
  webVitals?: NewsWebVitalsSummary
  locale: string
}

// Color palette for charts
const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

/**
 * Real Line Chart for activity timeline using Recharts
 */
function ActivityLineChart({ data }: { data: Array<{ date: string; views: number; likes: number; comments: number }> }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        <p>No activity data available</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="date" 
          className="text-xs"
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => {
            const date = new Date(value)
            return `${date.getMonth() + 1}/${date.getDate()}`
          }}
        />
        <YAxis className="text-xs" tick={{ fontSize: 12 }} />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
            fontSize: '12px'
          }}
        />
        <Legend wrapperStyle={{ fontSize: '12px' }} />
        <Line 
          type="monotone" 
          dataKey="views" 
          stroke="#3b82f6" 
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line 
          type="monotone" 
          dataKey="likes" 
          stroke="#10b981" 
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line 
          type="monotone" 
          dataKey="comments" 
          stroke="#f59e0b" 
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

/**
 * Real Bar Chart for engagement metrics using Recharts
 */
function EngagementBarChart({ data }: { data: Array<{ date: string; views: number; likes: number; comments: number }> }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        <p>No engagement data available</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="date" 
          className="text-xs"
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => {
            const date = new Date(value)
            return `${date.getMonth() + 1}/${date.getDate()}`
          }}
        />
        <YAxis className="text-xs" tick={{ fontSize: 12 }} />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
            fontSize: '12px'
          }}
        />
        <Legend wrapperStyle={{ fontSize: '12px' }} />
        <Bar dataKey="views" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="likes" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="comments" fill="#f59e0b" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/**
 * Real Pie Chart for category distribution using Recharts
 */
function CategoryPieChart({ data }: { data: Array<{ category: string; count: number }> }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        <p>No category data available</p>
      </div>
    )
  }

  const chartData = data.map((item, index) => ({
    name: item.category.replace('-', ' '),
    value: item.count,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
          outerRadius={90}
          fill="#8884d8"
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
            fontSize: '12px'
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

/**
 * Format a web-vitals metric value for display.
 * CLS is unitless (3 decimals), others are milliseconds.
 */
function formatVitalValue(name: string, value: number): string {
  if (name === 'CLS') return value.toFixed(3)
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`
  return `${Math.round(value)}ms`
}

/**
 * Get badge color class for web-vitals rating.
 */
function ratingBadgeClass(rating: string): string {
  switch (rating) {
    case 'good':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    case 'needs-improvement':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
    case 'poor':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
  }
}

function MetricCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  trendValue, 
  description 
}: {
  title: string
  value: string | number
  icon: React.ComponentType<any>
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  description?: string
}) {
  const getTrendColor = () => {
    switch (trend) {
      case 'up': return 'text-green-600'
      case 'down': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Activity

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        {trend && trendValue && (
          <div className={`flex items-center text-xs ${getTrendColor()} mt-1`}>
            <TrendIcon className="h-3 w-3 mr-1" />
            {trendValue}
          </div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

export function NewsAnalyticsDashboard({ 
  analytics, 
  webVitals,
  locale, 
}: NewsAnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d')
  const [selectedMetric, setSelectedMetric] = useState<'views' | 'likes' | 'comments'>('views')

  // Filter recentActivity based on selected timeRange
  const filteredActivity = React.useMemo(() => {
    const daysMap = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 } as const
    const days = daysMap[timeRange]
    return analytics.recentActivity.slice(-days)
  }, [analytics.recentActivity, timeRange])

  // Calculate trends (mock data)
  const trends = {
    articles: { value: '+12%', trend: 'up' as const },
    views: { value: '+23%', trend: 'up' as const },
    likes: { value: '+8%', trend: 'up' as const },
    comments: { value: '-5%', trend: 'down' as const }
  }

  // Top performing categories
  const topCategories = analytics.topCategories.slice(0, 5)

  // Recent high-performing articles
  const topArticles = analytics.popularArticles.slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">Dashboard Overview</h2>
          <Badge variant="outline" className="text-sm">
            Last updated: {format(new Date(), 'MMM dd, HH:mm')}
          </Badge>
        </div>
        
        <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="1y">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Articles"
          value={analytics.totalArticles}
          icon={FileText}
          trend={trends.articles.trend}
          trendValue={trends.articles.value}
          description="Published articles"
        />
        <MetricCard
          title="Total Views"
          value={analytics.totalViews}
          icon={Eye}
          trend={trends.views.trend}
          trendValue={trends.views.value}
          description="Article page views"
        />
        <MetricCard
          title="Total Likes"
          value={analytics.totalLikes}
          icon={Heart}
          trend={trends.likes.trend}
          trendValue={trends.likes.value}
          description="User engagements"
        />
        <MetricCard
          title="Total Comments"
          value={analytics.totalComments}
          icon={MessageCircle}
          trend={trends.comments.trend}
          trendValue={trends.comments.value}
          description="User discussions"
        />
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Activity Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Activity Timeline
                </CardTitle>
                <CardDescription>
                  Daily engagement metrics over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ActivityLineChart data={filteredActivity} />
              </CardContent>
            </Card>

            {/* Category Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Category Distribution
                </CardTitle>
                <CardDescription>
                  Articles by category
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CategoryPieChart data={topCategories} />
              </CardContent>
            </Card>
          </div>

          {/* Top Categories List */}
          <Card>
            <CardHeader>
              <CardTitle>Top Categories</CardTitle>
              <CardDescription>
                Most active content categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topCategories.map((category, index) => (
                  <div key={category.category} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-sm">
                        #{index + 1}
                      </Badge>
                      <span className="font-medium capitalize">
                        {category.category.replace('-', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        {category.count} articles
                      </span>
                      <Badge variant="secondary">
                        {((category.count / analytics.totalArticles) * 100).toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="space-y-6">
          {/* Top Performing Articles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Top Performing Articles
              </CardTitle>
              <CardDescription>
                Articles with highest engagement
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topArticles.map((article, index) => (
                  <div key={article.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant="outline" className="text-sm">
                          #{index + 1}
                        </Badge>
                        <Link 
                          href={`/${locale}/news/${article.slug}`}
                          className="font-medium hover:text-blue-600 line-clamp-1"
                        >
                          {article.title}
                        </Link>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {article.views} views
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="h-3 w-3" />
                          {article.likes} likes
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          {article.comments} comments
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge 
                        variant="secondary"
                        className="mb-1"
                      >
                        {article.category.replace('-', ' ')}
                      </Badge>
                      <div className="text-xs text-gray-500">
                        {formatDistanceToNow(article.publishedAt?.toDate() || article.createdAt.toDate(), { 
                          addSuffix: true 
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Engagement Metrics</CardTitle>
              <CardDescription>
                User interaction patterns and trends
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EngagementBarChart data={filteredActivity} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          {/* Web Vitals Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Core Web Vitals
              </CardTitle>
              <CardDescription>
                Real user experience metrics for news pages (filtered from platform-wide telemetry)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!webVitals?.hasData ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  <div className="text-center">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No web-vitals data collected yet for news pages</p>
                    <p className="text-xs mt-1">Metrics will appear once users browse news articles</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {webVitals.metrics.map((metric) => (
                    <div key={metric.name} className="p-3 border rounded-lg text-center">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-muted-foreground">{metric.name}</span>
                        <Badge className={`text-[10px] px-1.5 py-0 ${ratingBadgeClass(metric.rating)}`}>
                          {metric.rating}
                        </Badge>
                      </div>
                      <div className="text-xl font-bold">{formatVitalValue(metric.name, metric.value)}</div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        n={metric.sampleCount}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Engagement Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Avg. Engagement Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {analytics.totalViews > 0 
                    ? `${((analytics.totalLikes + analytics.totalComments) / analytics.totalViews * 100).toFixed(1)}%`
                    : '0%'
                  }
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  (likes + comments) / views
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Avg. Views per Article
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {analytics.totalArticles > 0
                    ? Math.round(analytics.totalViews / analytics.totalArticles)
                    : 0
                  }
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Across {analytics.totalArticles} articles
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Comments per Article
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">
                  {analytics.totalArticles > 0
                    ? (analytics.totalComments / analytics.totalArticles).toFixed(1)
                    : '0'
                  }
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Discussion engagement
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <div className="space-y-4">
            <Alert>
              <TrendingUp className="h-4 w-4" />
              <AlertTitle>Performance Insight</AlertTitle>
              <AlertDescription>
                Your articles with images receive 23% more engagement than text-only posts. 
                Consider adding visuals to boost reader interaction.
              </AlertDescription>
            </Alert>

            <Alert>
              <Calendar className="h-4 w-4" />
              <AlertTitle>Publishing Pattern</AlertTitle>
              <AlertDescription>
                Articles published on Tuesday and Wednesday show 15% higher view rates. 
                Optimal publishing time appears to be 10:00-12:00 AM.
              </AlertDescription>
            </Alert>

            <Alert>
              <Target className="h-4 w-4" />
              <AlertTitle>Content Recommendation</AlertTitle>
              <AlertDescription>
                "Platform Updates" and "Community" categories generate the most engagement. 
                Consider increasing content frequency in these areas.
              </AlertDescription>
            </Alert>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
} 