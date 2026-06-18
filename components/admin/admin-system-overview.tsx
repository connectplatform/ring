'use client'

import { useRouter } from 'next/navigation'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Shield,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES } from '@/constants/routes'
import type { ModulesAdminLabels } from '@/components/wrappers/admin-wrapper'
import type { Locale } from '@/i18n/shared'

interface AdminSystemOverviewProps {
  locale: Locale
  labels: ModulesAdminLabels
}

const systemStats = {
  users: { total: 15420, active: 8920, new: 245 },
  articles: { published: 987 },
  performance: { uptime: 99.9 },
}

const recentActivity = [
  { id: '1', message: 'New user registered: john@example.com', time: '2 min ago', icon: Users },
  { id: '2', message: 'Article "Platform Updates" published', time: '15 min ago', icon: FileText },
  { id: '3', message: 'Order #12345 completed', time: '1 hour ago', icon: CheckCircle },
  { id: '4', message: 'Failed login attempt detected', time: '2 hours ago', icon: AlertTriangle },
  { id: '5', message: 'User account suspended', time: '3 hours ago', icon: Shield },
]

export function AdminSystemOverview({ locale, labels }: AdminSystemOverviewProps) {
  const router = useRouter()
  const t = {
    systemStats: labels.systemStats ?? 'System Stats',
    totalUsers: labels.totalUsers ?? 'Total Users',
    publishedArticles: labels.publishedArticles ?? 'Published',
    activeUsers: labels.activeUsers ?? 'Active Users',
    newUsers: labels.newUsers ?? 'New Today',
    uptime: labels.uptime ?? 'Uptime',
    recentActivity: labels.recentActivity ?? 'Recent Activity',
    viewAllActivity: labels.viewAllActivity ?? 'View All Activity',
  }

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 shrink-0" />
            {t.systemStats}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {systemStats.users.total.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">{t.totalUsers}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{systemStats.articles.published}</div>
              <div className="text-xs text-muted-foreground">{t.publishedArticles}</div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.activeUsers}</span>
              <span>{systemStats.users.active.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.newUsers}</span>
              <span className="text-green-600">+{systemStats.users.new}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.uptime}</span>
              <span className="text-green-600">{systemStats.performance.uptime}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 shrink-0" />
            {t.recentActivity}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentActivity.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3">
              <div className="rounded bg-muted p-1">
                <activity.icon className="h-3 w-3" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm">{activity.message}</p>
                <p className="text-xs text-muted-foreground">{activity.time}</p>
              </div>
            </div>
          ))}
          <Button
            variant="link"
            className="h-auto p-0 text-sm"
            onClick={() => router.push(ROUTES.ADMIN_ACTIVITY(locale))}
          >
            {t.viewAllActivity} →
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
