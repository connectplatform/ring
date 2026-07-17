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
import { cn } from '@/lib/utils'
import { davinciGlassSurface, davinciPanelSurface } from '@/lib/ui/davinci'
import type { ModulesAdminLabels } from '@/components/wrappers/admin-wrapper'
import type { PlatformAnalyticsSummary } from '@/features/analytics/types/platform-analytics'
import type { SecurityOverviewSummary } from '@/features/admin/security/types/security-overview'
import { AdminRecentActivityFeed } from '@/components/admin/admin-recent-activity-feed'
import { toAppHref } from '@/i18n/routing'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'

interface AdminDashboardClientProps {
  analytics: PlatformAnalyticsSummary
  security: SecurityOverviewSummary
  labels: ModulesAdminLabels
  locale: Locale
}

function StatTile({
  value,
  label,
  hint,
  icon: Icon,
  href,
}: {
  value: string | number
  label: string
  hint?: string
  icon: React.ComponentType<{ className?: string }>
  href?: string
}) {
  const inner = (
    <div className={cn(davinciGlassSurface, 'p-4 transition-colors', href && 'hover:bg-foreground/5')}>
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

  if (!href) return inner
  return (
    <Link href={toAppHref(href)} className="block rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-[var(--davinci-beam)]/40">
      {inner}
    </Link>
  )
}

/**
 * Wallet-parity admin home: live System Stats hero → Recent Activity feed.
 * Module launchers live in the right rail / Admin supermenu — not here.
 */
export function AdminDashboardClient({
  analytics,
  security,
  labels,
  locale,
}: AdminDashboardClientProps) {
  const t = useTranslations('modules.admin')

  const pageViews = analytics.engagement.hasEventData
    ? analytics.engagement.pageViews
    : 0
  const sessions = analytics.engagement.hasEventData
    ? analytics.engagement.activeSessions24h
    : 0

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col space-y-6">
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
            href={ROUTES.ADMIN_USERS(locale)}
          />
          <StatTile
            value={sessions.toLocaleString()}
            label={t('dashboardStatsSessions')}
            hint={t('dashboardStatsSessionsHint')}
            icon={Activity}
            href={ROUTES.ADMIN_ANALYTICS(locale)}
          />
          <StatTile
            value={pageViews.toLocaleString()}
            label={t('dashboardStatsPageViews')}
            hint={t('dashboardStatsPageViewsHint')}
            icon={Eye}
            href={ROUTES.ADMIN_ANALYTICS(locale)}
          />
          <StatTile
            value={security.verificationQueueCount.toLocaleString()}
            label={t('dashboardStatsVerification')}
            hint={t('dashboardStatsVerificationHint')}
            icon={ShieldCheck}
            href={`${ROUTES.ADMIN_SECURITY(locale)}?tab=verification`}
          />
          <StatTile
            value={security.fraudCandidateCount.toLocaleString()}
            label={t('dashboardStatsFraud')}
            hint={t('dashboardStatsFraudHint', {
              count: security.highRiskFraudCount,
            })}
            icon={Shield}
            href={`${ROUTES.ADMIN_SECURITY(locale)}?tab=fraud`}
          />
          <StatTile
            value={analytics.errors.count24h.toLocaleString()}
            label={t('dashboardStatsErrors')}
            hint={t('dashboardStatsErrorsHint')}
            icon={AlertTriangle}
            href={ROUTES.ADMIN_ANALYTICS(locale)}
          />
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
