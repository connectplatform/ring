'use client'

import React, { useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  UserX,
  Activity,
  Clock,
  RefreshCw,
} from 'lucide-react'
import { FraudDeskClient } from '@/features/fraud/components/fraud-desk-client'
import VerificationQueuePanel from '@/features/admin/verification/verification-queue-panel'
import type { Locale } from '@/i18n/shared'
import {
  parseSecurityTab,
  type SecurityOverviewSummary,
  type SecurityTab,
} from '@/features/admin/security/types/security-overview'

function severityBadgeClass(severity: string) {
  switch (severity) {
    case 'critical':
      return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
    case 'high':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200'
    case 'low':
      return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200'
    default:
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200'
  }
}

function statusBadgeClass(status: string) {
  switch (status) {
    case 'resolved':
      return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200'
    case 'investigating':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200'
    default:
      return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
  }
}

interface MetricCardProps {
  title: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  description?: string
  highlight?: boolean
}

function MetricCard({ title, value, icon: Icon, description, highlight }: MetricCardProps) {
  return (
    <Card className={highlight && value > 0 ? 'border-orange-300 dark:border-orange-800' : undefined}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  )
}

export default function AdminSecurityCenterClient({
  data,
  locale,
}: {
  data: SecurityOverviewSummary
  locale: Locale
}) {
  const t = useTranslations('modules.admin.securityHub')
  const tAdmin = useTranslations('modules.admin')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const activeTab = parseSecurityTab(searchParams.get('tab'))

  const setTab = (tab: SecurityTab) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (tab === 'overview') {
        params.delete('tab')
      } else {
        params.set('tab', tab)
      }
      const query = params.toString()
      router.push(query ? `${pathname}?${query}` : pathname)
    })
  }

  const refreshOverview = () => {
    startTransition(() => {
      router.refresh()
    })
  }

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleString(locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  const verificationTabHref = `${pathname}?tab=verification`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
            <Shield className="h-8 w-8" />
            {tAdmin('securityCenter')}
          </h1>
          <p className="text-muted-foreground">{t('pageSubtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshOverview} disabled={isPending}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isPending ? 'animate-spin' : ''}`} />
          {tAdmin('refresh')}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setTab(parseSecurityTab(value))} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="overview">{t('tabOverview')}</TabsTrigger>
          <TabsTrigger value="fraud">{t('tabFraud')}</TabsTrigger>
          <TabsTrigger value="verification">{t('tabVerification')}</TabsTrigger>
          <TabsTrigger value="events">{t('tabEvents')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title={t('metricVerificationQueue')}
              value={data.verificationQueueCount}
              icon={ShieldCheck}
              highlight
            />
            <MetricCard
              title={t('metricFraudCandidates')}
              value={data.fraudCandidateCount}
              icon={ShieldAlert}
              description={
                data.highRiskFraudCount > 0
                  ? t('metricHighRisk', { count: data.highRiskFraudCount })
                  : undefined
              }
              highlight
            />
            <MetricCard
              title={t('metricSuspendedAccounts')}
              value={data.suspendedAccountCount}
              icon={UserX}
            />
            <MetricCard
              title={t('metricSecurityEvents')}
              value={data.securityEvents7d}
              icon={Activity}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('overviewQuickActions')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => setTab('fraud')}>
                <ShieldAlert className="h-4 w-4 mr-2" />
                {t('viewFraudQueue')}
              </Button>
              <Button variant="outline" onClick={() => setTab('verification')}>
                <ShieldCheck className="h-4 w-4 mr-2" />
                {t('viewVerificationQueue')}
              </Button>
              <Button variant="outline" onClick={() => setTab('events')}>
                <AlertTriangle className="h-4 w-4 mr-2" />
                {t('tabEvents')}
              </Button>
            </CardContent>
          </Card>

          {data.recentEvents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  {tAdmin('recentEvents')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.recentEvents.slice(0, 5).map((event) => (
                  <div key={event.id} className="border rounded-lg p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Badge className={severityBadgeClass(event.severity)}>{event.severity}</Badge>
                      <Badge className={statusBadgeClass(event.status)}>{event.status}</Badge>
                    </div>
                    <p>{event.details}</p>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(event.timestamp)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="fraud">
          <FraudDeskClient
            locale={locale}
            embedded
            verificationHref={verificationTabHref}
          />
        </TabsContent>

        <TabsContent value="verification">
          <VerificationQueuePanel locale={locale} />
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {tAdmin('recentEvents')}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{t('eventsSubtitle')}</p>
            </CardHeader>
            <CardContent>
              {data.recentEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-lg">
                  {t('eventsEmpty')}
                </p>
              ) : (
                <div className="space-y-4">
                  {data.recentEvents.map((event) => (
                    <div key={event.id} className="border rounded-lg p-4">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <Badge className={severityBadgeClass(event.severity)}>{event.severity}</Badge>
                        <Badge className={statusBadgeClass(event.status)}>{event.status}</Badge>
                        <span className="text-xs text-muted-foreground uppercase">
                          {event.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-sm">{event.details}</p>
                      {event.path && (
                        <p className="text-xs text-muted-foreground mt-1">{event.path}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(event.timestamp)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
