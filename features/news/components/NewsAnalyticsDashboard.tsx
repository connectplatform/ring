'use client'

import React, { useState } from 'react'
import { NewsAnalytics, NewsArticle } from '@/features/news/types'
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
  Users,
  Calendar,
  BarChart3,
  PieChart,
  LineChart,
  Target,
  Award,
  Zap
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import Link from 'next/link'

interface NewsAnalyticsDashboardProps {
  analytics: NewsAnalytics
  locale: string
  translations: any
}

// Mock chart components (replace with actual chart library like Recharts)
function MockLineChart({ data, title }: { data: any[], title: string }) {
  return (
    <div className="h-64 flex items-center justify-center bg-gray-50 rounded border-2 border-dashed border-gray-300">
      <div className="text-center">
        <LineChart className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-600">{title}</p>
        <p className="text-xs text-gray-500">Chart visualization</p>
      </div>
    </div>
  )
}

function MockBarChart({ data, title }: { data: any[], title: string }) {
  return (
    <div className="h-64 flex items-center justify-center bg-gray-50 rounded border-2 border-dashed border-gray-300">
      <div className="text-center">
        <BarChart3 className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-600">{title}</p>
        <p className="text-xs text-gray-500">Chart visualization</p>
      </div>
    </div>
  )
}

function MockPieChart({ data, title }: { data: any[], title: string }) {
  return (
    <div className="h-64 flex items-center justify-center bg-gray-50 rounded border-2 border-dashed border-gray-300">
      <div className="text-center">
        <PieChart className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-600">{title}</p>
        <p className="text-xs text-gray-500">Chart visualization</p>
      </div>
    </div>
  )
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
  locale, 
  translations 
}: NewsAnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d')
  const [selectedMetric, setSelectedMetric] = useState<'views' | 'likes' | 'comments'>('views')

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
                <MockLineChart 
                  data={analytics.recentActivity} 
                  title="Daily Activity" 
                />
              </CardContent>
            </Card>

            {/* Category Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Category Distribution
                </CardTitle>
                <CardDescription>
                  Articles by category
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MockPieChart 
                  data={topCategories} 
                  title="Content Categories" 
                />
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
              <MockBarChart 
                data={analytics.recentActivity} 
                title="Engagement Over Time" 
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Avg. Engagement Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">8.4%</div>
                <div className="text-sm text-gray-600 mt-1">
                  <TrendingUp className="h-3 w-3 inline mr-1" />
                  +2.1% vs last month
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Bounce Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">24.7%</div>
                <div className="text-sm text-gray-600 mt-1">
                  <TrendingDown className="h-3 w-3 inline mr-1" />
                  -1.2% vs last month
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Avg. Time on Page
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">3:24</div>
                <div className="text-sm text-gray-600 mt-1">
                  <TrendingUp className="h-3 w-3 inline mr-1" />
                  +0:15 vs last month
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