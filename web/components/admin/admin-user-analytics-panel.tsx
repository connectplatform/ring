'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PlatformAnalyticsSummary } from '@/features/analytics/types/platform-analytics'
import type { ModulesAdminLabels } from '@/components/wrappers/admin-wrapper'

function EmptyState({ message }: { message: string }) {
  return (
    <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-lg">
      {message}
    </p>
  )
}

/**
 * User Analytics panel shared by /admin/analytics (Users tab)
 * and /admin/users?tab=analytics.
 */
export function AdminUserAnalyticsPanel({
  data,
  labels,
}: {
  data: PlatformAnalyticsSummary
  labels: ModulesAdminLabels
}) {
  const t = useTranslations('modules.admin.webAnalytics')

  return (
    <div className="space-y-6">
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
      <Card>
        <CardHeader>
          <CardTitle>Device Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState message={t('empty.noDevices')} />
        </CardContent>
      </Card>
    </div>
  )
}
