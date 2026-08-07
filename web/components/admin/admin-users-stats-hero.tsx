'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'
import {
  Activity,
  Shield,
  Users,
  TrendingUp,
  UserCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { davinciGlassSurface, davinciPanelSurface } from '@/lib/ui/davinci'
import type { AdminUserStats } from '@/lib/admin/user-stats'
import type { ModulesAdminLabels } from '@/components/wrappers/admin-wrapper'

const ROLE_COLORS = [
  'oklch(0.72 0.14 195)',
  'oklch(0.70 0.16 145)',
  'oklch(0.75 0.14 55)',
  'oklch(0.68 0.18 300)',
  'oklch(0.65 0.20 25)',
  'oklch(0.72 0.10 250)',
]

interface AdminUsersStatsHeroProps {
  stats: AdminUserStats
  labels: ModulesAdminLabels
  className?: string
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

export function AdminUsersStatsHero({ stats, labels, className }: AdminUsersStatsHeroProps) {
  const t = useTranslations('modules.admin')

  const verifiedPct =
    stats.totalUsers === 0
      ? 0
      : Math.round((stats.verifiedUsers / stats.totalUsers) * 100)

  const roleChartData = useMemo(
    () =>
      Object.entries(stats.usersByRole)
        .filter(([, count]) => count > 0)
        .map(([role, count]) => ({
          name: role,
          value: count,
        })),
    [stats.usersByRole],
  )

  return (
    <section className={cn(davinciPanelSurface, 'p-5 sm:p-6', className)}>
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-5 w-5 text-[var(--davinci-beam)]" />
        <h2 className="text-lg font-semibold">
          {labels.systemStats ?? t('systemStats')}
        </h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:col-span-7">
          <StatTile
            value={stats.totalUsers.toLocaleString()}
            label={labels.totalUsers ?? t('totalUsers')}
            icon={Users}
          />
          <StatTile
            value={stats.activeUsers.toLocaleString()}
            label={labels.activeUsers ?? t('activeUsers')}
            hint={t('usersStatsActiveHint')}
            icon={Activity}
          />
          <StatTile
            value={`+${stats.newUsersToday}`}
            label={labels.newUsers ?? t('newUsers')}
            hint={t('usersStatsNewMonth', { count: stats.newUsersThisMonth })}
            icon={TrendingUp}
          />
          <StatTile
            value={`${stats.verifiedUsers.toLocaleString()} (${verifiedPct}%)`}
            label={t('usersStatsVerified')}
            hint={t('usersStatsUnverified', { count: stats.unverifiedUsers })}
            icon={UserCheck}
          />
        </div>

        <div className={cn(davinciGlassSurface, 'p-4 lg:col-span-5')}>
          <div className="mb-2 flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">{t('usersByRole')}</h3>
          </div>
          {roleChartData.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t('usersStatsNoRoles')}
            </p>
          ) : (
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={roleChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={2}
                    stroke="transparent"
                  >
                    {roleChartData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={ROLE_COLORS[index % ROLE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => {
                      const n = typeof value === 'number' ? value : Number(value) || 0
                      const pct =
                        stats.totalUsers === 0
                          ? 0
                          : Math.round((n / stats.totalUsers) * 100)
                      return [`${n} (${pct}%)`, t('usersByRole')]
                    }}
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value) => (
                      <span className="text-xs text-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
