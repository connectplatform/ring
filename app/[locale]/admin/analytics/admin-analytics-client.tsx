'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Activity,
  Users,
  Eye,
  Zap,
  AlertTriangle,
  CheckCircle,
  Server,
  Database,
} from 'lucide-react'
import type { PlatformAnalyticsSummary } from '@/features/analytics/types/platform-analytics'
import type { ModulesAdminLabels } from '@/components/wrappers/admin-wrapper'
import { AnalyticsForensicsRow } from '@/components/admin/analytics-forensics-row'

function formatVitalValue(name: string, value: number): string {
  if (name === 'CLS') return value.toFixed(3)
  if (name === 'FID' || name === 'INP' || name === 'TTFB') return `${Math.round(value)}ms`
  if (name === 'LCP' || name === 'FCP') return `${(value / 1000).toFixed(2)}s`
  return value.toLocaleString()
}

function ratingBadgeClass(rating: string): string {
  switch (rating) {
    case 'good':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    case 'needs-improvement':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
    case 'poor':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-lg">
      {message}
    </p>
  )
}

export default function AdminAnalyticsClient({
  projectName,
  data,
  labels,
}: {
  projectName: string
  data: PlatformAnalyticsSummary
  labels: ModulesAdminLabels
}) {
  const t = useTranslations('modules.admin.webAnalytics')

  return (
    <div className="container mx-auto px-0 py-0">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {t('title', { projectName })}
        </h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">{t('tabs.overview')}</TabsTrigger>
          <TabsTrigger value="webvitals">{t('tabs.webvitals')}</TabsTrigger>
          <TabsTrigger value="users">{t('tabs.users')}</TabsTrigger>
          <TabsTrigger value="errors">{t('tabs.errors')}</TabsTrigger>
          <TabsTrigger value="system">{t('tabs.system')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {labels.totalUsers ?? 'Total Users'}
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.platform.totalUsers}</div>
                <p className="text-xs text-muted-foreground">
                  +{data.platform.newUsers} {t('overview.thisWeek')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('overview.activeSessions')}
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.engagement.hasEventData
                    ? data.engagement.activeSessions24h
                    : '—'}
                </div>
                {!data.engagement.hasEventData && (
                  <p className="text-xs text-muted-foreground">{t('empty.noEvents')}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('overview.pageViews')}
                </CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.engagement.hasEventData ? data.engagement.pageViews : '—'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('overview.errorRate')}
                </CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.errors.count24h}</div>
                <p className="text-xs text-muted-foreground">{t('errors.last24h')}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{labels.recentActivity ?? 'Recent Activity'}</CardTitle>
              </CardHeader>
              <CardContent>
                <EmptyState message={t('empty.noActivity')} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Traffic Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <EmptyState message={t('empty.noTraffic')} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="webvitals">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                {t('webvitals.title')}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{t('webvitals.subtitle')}</p>
            </CardHeader>
            <CardContent>
              {!data.webVitals.hasData ? (
                <EmptyState message={t('empty.noVitals')} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {data.webVitals.metrics.map((metric) => (
                    <div key={metric.name} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium text-sm">{metric.name}</h3>
                        <Badge className={ratingBadgeClass(metric.rating)}>
                          {metric.rating}
                        </Badge>
                      </div>
                      <div className="text-2xl font-bold mb-1">
                        {formatVitalValue(metric.name, metric.value)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        n={metric.sampleCount}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">{labels.totalUsers}</p>
                <p className="text-2xl font-bold">{data.platform.totalUsers}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">{labels.newUsers ?? 'New users'}</p>
                <p className="text-2xl font-bold">{data.platform.newUsers}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">{t('overview.pageViews')}</p>
                <p className="text-2xl font-bold">
                  {data.engagement.hasEventData ? data.engagement.pageViews : 0}
                </p>
              </CardContent>
            </Card>
          </div>
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Device Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState message={t('empty.noDevices')} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                {t('errors.title')}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{t('errors.subtitle')}</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-muted-foreground">{t('errors.last24h')}</p>
                  <p className="text-2xl font-bold">{data.errors.count24h}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Period total</p>
                  <p className="text-2xl font-bold">{data.errors.countPeriod}</p>
                </div>
              </div>
              {!data.errors.hasData && !data.docs.hasData ? (
                <EmptyState message={t('empty.noErrors')} />
              ) : (
                <div className="space-y-6">
                  {data.docs.hasData ? (
                    <div className="space-y-3">
                      <p className="text-sm font-medium">{t('errors.docsNotFound')}</p>
                      <div className="grid grid-cols-2 gap-4 mb-2">
                        <div>
                          <p className="text-xs text-muted-foreground">{t('errors.docsNotFound24h')}</p>
                          <p className="text-xl font-bold">{data.docs.notFoundCount24h}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t('errors.docsNotFoundPeriod')}</p>
                          <p className="text-xl font-bold">{data.docs.notFoundCountPeriod}</p>
                        </div>
                      </div>
                      {data.docs.recentNotFound.map((row) => (
                        <AnalyticsForensicsRow key={row.id} trace={row} badgeLabel="docs_404" />
                      ))}
                    </div>
                  ) : null}
                  {data.errors.hasData ? (
                    <div className="space-y-3">
                      <p className="text-sm font-medium">{t('errors.recent')}</p>
                      {data.errors.recent.map((err) => (
                        <AnalyticsForensicsRow key={err.id} trace={err} />
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                {t('system.title')}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{t('system.subtitle')}</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4" />
                    <span className="text-sm font-medium">{labels.totalUsers}</span>
                  </div>
                  <p className="text-2xl font-bold">{data.platform.totalUsers}</p>
                  <CheckCircle className="h-3 w-3 text-green-600 inline mt-2" />
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="h-4 w-4" />
                    <span className="text-sm font-medium">{t('system.entities')}</span>
                  </div>
                  <p className="text-2xl font-bold">{data.platform.totalEntities}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-4 w-4" />
                    <span className="text-sm font-medium">{t('system.opportunities')}</span>
                  </div>
                  <p className="text-2xl font-bold">{data.platform.totalOpportunities}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
