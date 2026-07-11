'use client'

import React, { useTransition, useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import {
  Users,
  Target,
  Zap,
  Clock,
  Award,
  RefreshCw,
  Download,
  Settings,
  BarChart3,
  LineChart,
} from 'lucide-react'
import EntityModerationPanel from '@/features/admin/matcher/entity-moderation-panel'
import type { MatcherAnalyticsSummary, MatcherTimeframe } from '@/features/admin/matcher/types/matcher-analytics'
import { MATCHER_TIMEFRAMES } from '@/features/admin/matcher/types/matcher-analytics'
import type { Locale } from '@/i18n/shared'

function EmptyState({ message }: { message: string }) {
  return (
    <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-lg">
      {message}
    </p>
  )
}

interface MetricCardProps {
  title: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  description?: string
}

function MetricCard({ title, value, icon: Icon, description }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <Icon className="w-8 h-8 text-muted-foreground" />
        </div>
        {description && <p className="text-xs text-muted-foreground mt-2">{description}</p>}
      </CardContent>
    </Card>
  )
}

export default function AdminMatcherClient({
  data,
  locale,
  settingsPath,
}: {
  data: MatcherAnalyticsSummary
  locale: Locale
  settingsPath: string
}) {
  const t = useTranslations('modules.admin.matcher')
  const tAdmin = useTranslations('modules.admin')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [analyticsTab, setAnalyticsTab] = useState('performance')

  const tabParam = searchParams.get('tab')
  const activeTab = tabParam === 'moderation' ? 'moderation' : analyticsTab

  const handleTabChange = (value: string) => {
    if (value === 'moderation') {
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('tab', 'moderation')
        router.push(`${pathname}?${params.toString()}`)
      })
      return
    }

    setAnalyticsTab(value)
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('tab')
      const query = params.toString()
      router.push(query ? `${pathname}?${query}` : pathname)
    })
  }

  const handleTimeframeChange = (value: MatcherTimeframe) => {
    startTransition(() => {
      router.push(`${pathname}?timeframe=${value}`)
    })
  }

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh()
    })
  }

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `matcher-analytics-${data.timeframe}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const engagementPct = data.engagement.hasEngagementData
    ? Math.round(data.engagement.notificationReadRate * 100)
    : 0

  const distributionTotal = Object.values(data.quality.distribution).reduce((a, b) => a + b, 0)
  const distributionPct = (count: number) =>
    distributionTotal > 0 ? Math.round((count / distributionTotal) * 1000) / 10 : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={data.timeframe} onValueChange={(v) => handleTimeframeChange(v as MatcherTimeframe)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MATCHER_TIMEFRAMES.map((tf) => (
                <SelectItem key={tf} value={tf}>
                  {tf}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleRefresh} disabled={isPending}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isPending ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            {t('export')}
          </Button>
          <Button variant="outline" asChild>
            <Link href={settingsPath}>
              <Settings className="w-4 h-4 mr-2" />
              {t('configSummary.editSettings')}
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('configSummary.title')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <p>
            {t('configSummary.threshold')}: <strong>{Math.round(data.config.scoreThreshold * 100)}%</strong>
          </p>
          <p>
            {t('configSummary.maxMatches')}: <strong>{data.config.maxMatches}</strong>
          </p>
          <p>
            {t('configSummary.autoApprove')}: <strong>{data.config.autoApprove ? t('configSummary.on') : t('configSummary.off')}</strong>
          </p>
          <p>
            {t('configSummary.autoApproveMin')}: <strong>{Math.round(data.config.autoApproveMinScore * 100)}%</strong>
          </p>
          <p>
            {t('configInstallOnly')}: <strong>{Math.round(data.config.llmConfidenceGate * 100)}%</strong>
          </p>
          <p className="text-muted-foreground">
            {t('configSummary.source')}: {data.config.source}
          </p>
        </CardContent>
      </Card>

      {!data.hasData && (
        <EmptyState message={t('empty.noData')} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title={t('metrics.totalMatches')}
          value={data.overview.totalMatchNotifications.toLocaleString()}
          icon={Users}
          description={t('metrics.totalMatchesDesc')}
        />
        <MetricCard
          title={t('metrics.averageScore')}
          value={data.hasData ? `${data.overview.averageMatchScore}%` : '—'}
          icon={Target}
          description={t('metrics.averageScoreDesc')}
        />
        <MetricCard
          title={t('metrics.engagementRate')}
          value={data.engagement.hasEngagementData ? `${engagementPct}%` : '—'}
          icon={Zap}
          description={t('metrics.engagementRateDesc')}
        />
        <MetricCard
          title={t('metrics.matchRuns')}
          value={data.overview.totalMatchRuns.toLocaleString()}
          icon={BarChart3}
          description={t('metrics.matchRunsDesc')}
        />
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="performance">{t('tabs.performance')}</TabsTrigger>
          <TabsTrigger value="quality">{t('tabs.quality')}</TabsTrigger>
          <TabsTrigger value="usage">{t('tabs.usage')}</TabsTrigger>
          <TabsTrigger value="trends">{t('tabs.trends')}</TabsTrigger>
          <TabsTrigger value="moderation">{tAdmin('matcherModeration.tab')}</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  {t('performance.autoFillAccuracy')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.performance.autoFillAvgConfidence !== null ? (
                  <div className="space-y-4">
                    <span className="text-2xl font-bold">{data.performance.autoFillAvgConfidence}%</span>
                    <Progress value={data.performance.autoFillAvgConfidence} className="h-3" />
                    <p className="text-sm text-muted-foreground">{t('performance.autoFillDesc')}</p>
                  </div>
                ) : (
                  <EmptyState message={t('empty.noAutoFill')} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  {t('performance.processingTime')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.overview.averageProcessingTimeMs > 0 ? (
                  <div className="space-y-4">
                    <span className="text-2xl font-bold">
                      {(data.overview.averageProcessingTimeMs / 1000).toFixed(2)}s
                    </span>
                    <p className="text-sm text-muted-foreground">{t('performance.processingDesc')}</p>
                  </div>
                ) : (
                  <EmptyState message={t('empty.noProcessingTime')} />
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('performance.llmUsage')}</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState message={t('empty.llmUsage')} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('quality.matchDistribution')}</CardTitle>
            </CardHeader>
            <CardContent>
              {distributionTotal > 0 ? (
                <div className="space-y-4">
                  {(Object.keys(data.quality.distribution) as Array<keyof typeof data.quality.distribution>).map(
                    (level) => {
                      const count = data.quality.distribution[level]
                      const pct = distributionPct(count)
                      const color =
                        level === 'excellent'
                          ? 'bg-green-500'
                          : level === 'good'
                            ? 'bg-blue-500'
                            : level === 'fair'
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                      return (
                        <div key={level} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="capitalize">{t(`quality.levels.${level}`)}</span>
                            <span>{pct}% ({count})</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-3">
                            <div className={`h-3 rounded-full ${color}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    },
                  )}
                </div>
              ) : (
                <EmptyState message={t('empty.noQuality')} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('quality.userEngagement')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm">{t('quality.clickRate')}</span>
                <span className="font-medium">
                  {data.engagement.hasEngagementData ? `${engagementPct}%` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">{t('quality.acceptanceRate')}</span>
                <span className="font-medium">—</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">{t('quality.feedbackRate')}</span>
                <span className="font-medium">—</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('usage.dailyMatches')}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.trends.daily.some((d) => d.notifications > 0 || d.runs > 0) ? (
                <div className="space-y-3">
                  {data.trends.daily.map((day) => (
                    <div key={day.date} className="flex items-center justify-between">
                      <span className="text-sm">{day.date}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">
                          {day.notifications} {t('usage.notifications')} / {day.runs} {t('usage.runs')}
                        </span>
                        {day.avgScore > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {day.avgScore}%
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState message={t('empty.noTrends')} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LineChart className="w-5 h-5" />
                {t('trends.matchTrends')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.trends.daily.some((d) => d.notifications > 0 || d.runs > 0) ? (
                <div className="space-y-2 text-sm">
                  {data.trends.daily.map((day) => (
                    <div key={day.date} className="flex justify-between border-b py-2 last:border-0">
                      <span>{day.date}</span>
                      <span>
                        {t('usage.notifications')}: {day.notifications} · {t('usage.runs')}: {day.runs}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState message={t('trends.chartPlaceholder')} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="moderation" className="space-y-6">
          <EntityModerationPanel locale={locale} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
