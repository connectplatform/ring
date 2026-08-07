'use client'

import { useMemo, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { AuthUser } from '@/features/auth/types'
import type { ModulesAdminLabels } from '@/components/wrappers/admin-wrapper'
import type { PlatformAnalyticsSummary } from '@/features/analytics/types/platform-analytics'
import type { Locale } from '@/i18n/shared'
import { computeAdminUserStats } from '@/lib/admin/user-stats'
import { AdminUsersStatsHero } from '@/components/admin/admin-users-stats-hero'
import { AdminRecentActivityFeed } from '@/components/admin/admin-recent-activity-feed'
import { AdminUserManager } from '@/features/auth/components/admin-user-manager'
import { AdminUserAnalyticsPanel } from '@/components/admin/admin-user-analytics-panel'
import VerificationQueuePanel from '@/features/admin/verification/verification-queue-panel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type UsersDashboardTab = 'overview' | 'users' | 'verification' | 'analytics'

function parseUsersTab(raw: string | null): UsersDashboardTab {
  if (raw === 'users' || raw === 'verification' || raw === 'analytics') return raw
  return 'overview'
}

interface AdminUsersDashboardClientProps {
  initialUsers: AuthUser[]
  locale: string
  labels: ModulesAdminLabels
  analytics: PlatformAnalyticsSummary
}

export function AdminUsersDashboardClient({
  initialUsers,
  locale,
  labels,
  analytics,
}: AdminUsersDashboardClientProps) {
  const t = useTranslations('modules.admin')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const activeTab = parseUsersTab(searchParams.get('tab'))
  const stats = useMemo(() => computeAdminUserStats(initialUsers), [initialUsers])

  const setTab = (tab: string) => {
    const next = parseUsersTab(tab)
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (next === 'overview') {
        params.delete('tab')
      } else {
        params.set('tab', next)
      }
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    })
  }

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {t('usersDashboard')}
        </h1>
        <p className="text-muted-foreground">{t('usersDashboardDescription')}</p>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={setTab}
        className={`space-y-6${isPending ? ' opacity-80' : ''}`}
      >
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="overview">
            {labels.usersTabOverview ?? t('usersTabOverview')}
          </TabsTrigger>
          <TabsTrigger value="users">
            {labels.usersTabUsers ?? t('usersTabUsers')}
          </TabsTrigger>
          <TabsTrigger value="verification">
            {labels.usersTabVerification ?? t('usersTabVerification')}
          </TabsTrigger>
          <TabsTrigger value="analytics">
            {labels.usersTabAnalytics ?? t('usersTabAnalytics')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <AdminUsersStatsHero stats={stats} labels={labels} />
          <div className="min-h-0 flex-1">
            <AdminRecentActivityFeed
              title={labels.recentActivity ?? t('recentActivity')}
              limit={24}
              className="h-full min-h-[22rem]"
            />
          </div>
        </TabsContent>

        <TabsContent value="users">
          <AdminUserManager initialUsers={initialUsers} locale={locale} mode="table" />
        </TabsContent>

        <TabsContent value="verification">
          <VerificationQueuePanel locale={locale as Locale} />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">
            {labels.usersTabAnalytics ?? t('usersTabAnalytics')}
          </h2>
          <AdminUserAnalyticsPanel data={analytics} labels={labels} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
