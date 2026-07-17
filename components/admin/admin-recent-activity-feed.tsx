'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Coins,
  CreditCard,
  Shield,
  Users,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { davinciPanelSurface } from '@/lib/ui/davinci'
import type { AdminActivityFilter, AdminActivityItem } from '@/lib/admin/recent-activity'

function iconFor(item: AdminActivityItem) {
  switch (item.category) {
    case 'new_user':
      return Users
    case 'verification':
      return Shield
    case 'payments':
      return CreditCard
    case 'rewards':
      return Coins
    default:
      return item.type.includes('fail') ? AlertTriangle : CheckCircle
  }
}

function formatRelative(timeMs: number, t: ReturnType<typeof useTranslations>) {
  const delta = Date.now() - timeMs
  const mins = Math.floor(delta / 60000)
  if (mins < 1) return t('activityJustNow')
  if (mins < 60) return t('activityMinutesAgo', { count: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('activityHoursAgo', { count: hours })
  const days = Math.floor(hours / 24)
  return t('activityDaysAgo', { count: days })
}

export interface AdminRecentActivityFeedProps {
  title?: string
  initialFilter?: AdminActivityFilter
  limit?: number
  className?: string
}

export function AdminRecentActivityFeed({
  title,
  initialFilter = 'all',
  limit = 20,
  className,
}: AdminRecentActivityFeedProps) {
  const t = useTranslations('modules.admin')
  const [filter, setFilter] = useState<AdminActivityFilter>(initialFilter)
  const [items, setItems] = useState<AdminActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const filterTabs: { value: AdminActivityFilter; label: string }[] = [
    { value: 'all', label: t('activityFilterAll') },
    { value: 'new_user', label: t('activityFilterNewUser') },
    { value: 'verification', label: t('activityFilterVerification') },
    { value: 'payments', label: t('activityFilterPayments') },
    { value: 'rewards', label: t('activityFilterRewards') },
  ]

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    void fetch(`/api/admin/activity?filter=${filter}&limit=${limit}`, { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || t('activityLoadFailed'))
        if (!cancelled) setItems(data.items ?? [])
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('activityLoadFailed'))
          setItems([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [filter, limit])

  return (
    <Card className={cn(davinciPanelSurface, 'border-0 shadow-none', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 shrink-0" />
          {title ?? t('recentActivity')}
        </CardTitle>
        <Tabs
          value={filter}
          onValueChange={(v) => setFilter(v as AdminActivityFilter)}
          className="mt-2"
        >
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-5">
            {filterTabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="max-h-[min(50vh,28rem)] space-y-3 overflow-y-auto">
        {loading && (
          <div className="flex justify-center py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!loading && !error && items.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t('activityEmpty')}
          </p>
        )}

        {!loading &&
          items.map((item) => {
            const Icon = iconFor(item)
            return (
              <div key={item.id} className="flex items-start gap-3">
                <div className="rounded bg-muted p-1">
                  <Icon className="h-3 w-3" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{item.message}</p>
                  <p className="text-xs text-muted-foreground">{formatRelative(item.timeMs, t)}</p>
                </div>
              </div>
            )
          })}
      </CardContent>
    </Card>
  )
}
