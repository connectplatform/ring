'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'
import type { Locale } from '@/i18n/shared'
import type { SubscriptionLedgerRow } from '@/lib/payments/subscription/subscription-ledger-schema'
import { CreditCard, Loader2, RefreshCw } from 'lucide-react'

interface SubscriptionsClientProps {
  locale: Locale
}

interface SubscriptionStats {
  total: number
  active: number
  grace_period: number
  expired: number
  cancelled: number
  suspended: number
  byProvider: {
    stripe: number
    wayforpay: number
    credit_balance: number
    native_token: number
    nft_gate: number
    paypal: number
  }
  byMethod: {
    card: number
    credit_balance: number
    crypto: number
    nft: number
  }
  totalRevenue: number
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'active':
      return 'default'
    case 'grace_period':
      return 'secondary'
    case 'expired':
    case 'cancelled':
      return 'destructive'
    case 'suspended':
      return 'outline'
    default:
      return 'outline'
  }
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount)
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString()
}

export function SubscriptionsClient({ locale }: SubscriptionsClientProps) {
  const t = useTranslations('modules.admin.subscriptions')
  const tAdmin = useTranslations('modules.admin')
  const adminLabels = buildModulesAdminLabels(tAdmin)

  const [subscriptions, setSubscriptions] = useState<SubscriptionLedgerRow[]>([])
  const [stats, setStats] = useState<SubscriptionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [subsRes, statsRes] = await Promise.all([
        fetch('/api/admin/subscriptions', { credentials: 'include' }),
        fetch('/api/admin/subscriptions/stats', { credentials: 'include' }),
      ])

      const subsJson = await subsRes.json()
      const statsJson = await statsRes.json()

      if (!subsRes.ok) throw new Error(subsJson.error || t('loadError'))
      if (!statsRes.ok) throw new Error(statsJson.error || t('loadError'))

      setSubscriptions(subsJson.subscriptions ?? [])
      setStats(statsJson.stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  return (
    <AdminWrapper
      locale={locale}
      pageContext="subscriptions"
      labels={adminLabels}
    >
      <div className="space-y-6">
        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Subscriptions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Active</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.active}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Grace Period</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{stats.grace_period}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(stats.totalRevenue, 'USD')}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Provider Breakdown */}
        {stats && (
          <Card>
            <CardHeader>
              <CardTitle>Subscriptions by Provider</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(stats.byProvider).map(([provider, count]) => (
                  <div key={provider} className="flex items-center justify-between">
                    <span className="capitalize">{provider.replace('_', ' ')}</span>
                    <Badge variant="secondary">{count as number}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Subscriptions Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Subscriptions</CardTitle>
              <button
                onClick={() => void loadData()}
                disabled={loading}
                className="p-2 hover:bg-gray-100 rounded"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {loading && subscriptions.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : subscriptions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CreditCard className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>No subscriptions found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">User</th>
                      <th className="text-left py-2 px-3">Provider</th>
                      <th className="text-left py-2 px-3">Status</th>
                      <th className="text-right py-2 px-3">Amount</th>
                      <th className="text-right py-2 px-3">Next Payment</th>
                      <th className="text-right py-2 px-3">Failed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((sub) => (
                      <tr key={sub.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 font-mono text-xs">
                          {sub.user_id.slice(0, 8)}...
                        </td>
                        <td className="py-2 px-3 capitalize">
                          {sub.provider.replace('_', ' ')}
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant={statusVariant(sub.status)}>
                            {sub.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-right">
                          {formatCurrency(sub.amount, sub.currency)}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {formatDate(sub.next_payment_due)}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {sub.failed_attempts > 0 && (
                            <Badge variant="destructive">{sub.failed_attempts}</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminWrapper>
  )
}
