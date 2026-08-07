'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AlertCircle, CheckCircle2, Coins, Loader2, OctagonX, Users } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import type { RewardStatsRange } from '@/lib/admin/reward-stats'

type RewardStats = Awaited<ReturnType<typeof import('@/lib/admin/reward-stats').getAdminRewardStats>>

type RewardEvent = Record<string, unknown>

const tooltipStyle = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '6px',
  fontSize: '12px',
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string
  value: string | number
  detail: string
  icon: typeof Coins
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

function eventTime(event: RewardEvent): string {
  const raw = event.completed_at ?? event.created_at ?? event.updated_at
  const date = raw ? new Date(String(raw)) : null
  return date && Number.isFinite(date.getTime()) ? date.toLocaleString() : '—'
}

export function AdminRewardsDashboard({ locale }: { locale: Locale }) {
  const [range, setRange] = useState<RewardStatsRange>('28d')
  const [stats, setStats] = useState<RewardStats | null>(null)
  const [events, setEvents] = useState<RewardEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('all')
  const [trigger, setTrigger] = useState('')
  const [userId, setUserId] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void fetch(`/api/admin/rewards/stats?range=${range}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Failed to load reward statistics')
        if (!cancelled) setStats(payload.stats)
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Failed to load reward statistics')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [range])

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ limit: '50' })
    if (status !== 'all') params.set('status', status)
    if (trigger.trim()) params.set('trigger', trigger.trim())
    if (userId.trim()) params.set('userId', userId.trim())

    setLoadingEvents(true)
    void fetch(`/api/admin/rewards/events?${params}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Failed to load reward events')
        if (!cancelled) setEvents(payload.events ?? [])
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Failed to load reward events')
      })
      .finally(() => {
        if (!cancelled) setLoadingEvents(false)
      })
    return () => {
      cancelled = true
    }
  }, [status, trigger, userId])

  if (loading && !stats) {
    return (
      <div className="flex min-h-80 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading reward monitoring…
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex min-h-80 items-center justify-center gap-2 text-destructive">
        <AlertCircle className="h-5 w-5" /> {error ?? 'Reward statistics are unavailable.'}
      </div>
    )
  }

  const unit = stats.unitLabel
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reward monitoring</h1>
          <p className="text-muted-foreground">Credit reward events, mint volume, and delivery health.</p>
        </div>
        <Select value={range} onValueChange={(value) => setRange(value as RewardStatsRange)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="28d">Last 28 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Completed rewards" value={stats.totals.completedCount.toLocaleString()} detail={`Completed events in ${range}`} icon={CheckCircle2} />
        <MetricCard title={`${unit} minted`} value={stats.totals.pointsMinted.toLocaleString()} detail="Completed reward credits" icon={Coins} />
        <MetricCard title="Cap skips" value={stats.totals.skippedCapCount.toLocaleString()} detail="Skipped because of a reward cap" icon={Users} />
        <MetricCard title="Failed rewards" value={stats.totals.failedCount.toLocaleString()} detail="Events that did not mint" icon={OctagonX} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily minted {unit}</CardTitle>
            <CardDescription>Completed credit rewards grouped by UTC day.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.seriesDaily}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tickFormatter={(date) => date.slice(5)} tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="points" name={unit} stroke="#8b5cf6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Rewards by trigger</CardTitle>
            <CardDescription>Completed credit rewards by event trigger.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.byTrigger}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="trigger" tick={{ fontSize: 11 }} interval={0} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="points" name={unit} fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Rewards by role</CardTitle>
            <CardDescription>Role data is shown when recorded on the event metadata.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stats.byRole}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="role" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="points" name={unit} fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top earners</CardTitle>
            <CardDescription>Users ranked by completed reward credits in the selected range.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-muted-foreground">
                <tr><th className="pb-2 font-medium">User</th><th className="pb-2 text-right font-medium">{unit}</th><th className="pb-2 text-right font-medium">Events</th></tr>
              </thead>
              <tbody>
                {stats.topEarners.map((earner) => (
                  <tr key={earner.userId} className="border-b last:border-0">
                    <td className="py-2 font-mono text-xs"><Link className="hover:underline" href={ROUTES.ADMIN_USERS(locale)}>{earner.userId}</Link></td>
                    <td className="py-2 text-right tabular-nums">{earner.points.toLocaleString()}</td>
                    <td className="py-2 text-right tabular-nums">{earner.events}</td>
                  </tr>
                ))}
                {!stats.topEarners.length ? <tr><td colSpan={3} className="py-6 text-center text-muted-foreground">No completed rewards in this range.</td></tr> : null}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reward events</CardTitle>
          <CardDescription>Most recent 2,000 reward events are available for this MVP; this table shows the first 50 matching events.</CardDescription>
          <div className="grid gap-2 pt-2 sm:grid-cols-3">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="failed">Failed</SelectItem><SelectItem value="skipped">Skipped</SelectItem></SelectContent>
            </Select>
            <Input value={trigger} onChange={(event) => setTrigger(event.target.value)} placeholder="Filter trigger" />
            <Input value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="Filter user ID" />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loadingEvents ? <div className="flex justify-center py-6 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b text-left text-muted-foreground">
                <tr><th className="pb-2 font-medium">When</th><th className="pb-2 font-medium">User</th><th className="pb-2 font-medium">Trigger</th><th className="pb-2 font-medium">Status</th><th className="pb-2 text-right font-medium">Amount</th></tr>
              </thead>
              <tbody>
                {events.map((event, index) => (
                  <tr key={displayValue(event.id) !== '—' ? displayValue(event.id) : index} className="border-b last:border-0">
                    <td className="py-2 whitespace-nowrap">{eventTime(event)}</td>
                    <td className="py-2 font-mono text-xs">{displayValue(event.user_id ?? event.userId)}</td>
                    <td className="py-2">{displayValue(event.trigger)}</td>
                    <td className="py-2 capitalize">{displayValue(event.status)}</td>
                    <td className="py-2 text-right tabular-nums">{displayValue(event.amount)} {unit}</td>
                  </tr>
                ))}
                {!events.length ? <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No reward events match these filters.</td></tr> : null}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
