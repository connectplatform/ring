'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  Activity,
  AlertTriangle,
  Eye,
  Shield,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { davinciGlassSurface, davinciPanelSurface } from '@/lib/ui/davinci'
import type { ModulesAdminLabels } from '@/components/wrappers/admin-wrapper'
import type { PlatformAnalyticsSummary } from '@/features/analytics/types/platform-analytics'
import type { SecurityOverviewSummary } from '@/features/admin/security/types/security-overview'
import type { AdminNavIconKey } from '@/features/admin/admin-nav-config'
import { AdminNavIcon } from '@/features/admin/admin-nav-icons'
import { AdminRecentActivityFeed } from '@/components/admin/admin-recent-activity-feed'
import { toAppHref } from '@/i18n/routing'

export interface AdminDashboardModuleTile {
  id: string
  title: string
  description: string
  href: string
  icon: AdminNavIconKey
  color: string
}

interface AdminDashboardClientProps {
  analytics: PlatformAnalyticsSummary
  security: SecurityOverviewSummary
  modules: AdminDashboardModuleTile[]
  labels: ModulesAdminLabels
}

function StatTile({
  value,
  label,
  hint,
  icon: Icon,
}: {
  value: string | number
  label: string
  hint?: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className={cn(davinciGlassSurface, 'p-4')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-2xl font-bold tracking-tight text-[var(--davinci-beam)] tabular-nums">
            {value}
          </div>
          <div className="mt-1 text-sm font-semibold text-foreground">{label}</div>
          {hint ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
    </div>
  )
}

export function AdminDashboardClient({
  analytics,
  security,
  modules,
  labels,
}: AdminDashboardClientProps) {
  const t = useTranslations('modules.admin')

  const pageViews = analytics.engagement.hasEventData
    ? analytics.engagement.pageViews
    : 0
  const sessions = analytics.engagement.hasEventData
    ? analytics.engagement.activeSessions24h
    : 0

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col gap-6">
      <section className={cn(davinciPanelSurface, 'p-5 sm:p-6')}>
        <div className="mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-[var(--davinci-beam)]" />
          <h2 className="text-lg font-semibold">
            {labels.systemStats ?? t('systemStats')}
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile
            value={analytics.platform.totalUsers.toLocaleString()}
            label={labels.totalUsers ?? t('totalUsers')}
            hint={t('dashboardStatsNewUsers', {
              count: analytics.platform.newUsers,
            })}
            icon={Users}
          />
          <StatTile
            value={sessions.toLocaleString()}
            label={t('dashboardStatsSessions')}
            hint={t('dashboardStatsSessionsHint')}
            icon={Activity}
          />
          <StatTile
            value={pageViews.toLocaleString()}
            label={t('dashboardStatsPageViews')}
            hint={t('dashboardStatsPageViewsHint')}
            icon={Eye}
          />
          <StatTile
            value={security.verificationQueueCount.toLocaleString()}
            label={t('dashboardStatsVerification')}
            hint={t('dashboardStatsVerificationHint')}
            icon={ShieldCheck}
          />
          <StatTile
            value={security.fraudCandidateCount.toLocaleString()}
            label={t('dashboardStatsFraud')}
            hint={t('dashboardStatsFraudHint', {
              count: security.highRiskFraudCount,
            })}
            icon={Shield}
          />
          <StatTile
            value={analytics.errors.count24h.toLocaleString()}
            label={t('dashboardStatsErrors')}
            hint={t('dashboardStatsErrorsHint')}
            icon={AlertTriangle}
          />
        </div>
      </section>

      <section className={cn(davinciPanelSurface, 'p-5 sm:p-6')}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t('dashboardModules')}</h2>
          <p className="text-xs text-muted-foreground">{t('dashboardModulesHint')}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map((mod) => (
            <div
              key={mod.id}
              className={cn(davinciGlassSurface, 'flex flex-col gap-3 p-4')}
            >
              <div className="flex items-start gap-3">
                <div className={cn('rounded-lg p-2.5 text-white', mod.color)}>
                  <AdminNavIcon name={mod.icon} className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-foreground">{mod.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                    {mod.description}
                  </p>
                </div>
              </div>
              <Button asChild size="sm" className="w-full">
                <Link href={toAppHref(mod.href)}>
                  {t('dashboardOpenModule', { name: mod.title })}
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </section>

      <div className="min-h-0 flex-1">
        <AdminRecentActivityFeed
          title={labels.recentActivity ?? t('recentActivity')}
          limit={24}
          className="h-full min-h-[22rem]"
        />
      </div>
    </div>
  )
}
