'use client'

/**
 * Recent Orders Component
 * 
 * Displays recent vendor orders with status
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import { useTranslations } from 'next-intl'

export type VendorRecentOrderRow = {
  id: string
  status: string
  total?: number
  createdAt?: string
  customer?: string
  netAmount?: number
}

export function RecentOrders({
  orders,
  locale,
}: {
  orders: VendorRecentOrderRow[]
  locale: string
}) {
  const t = useTranslations('vendor.dashboard.recentOrders')
  const loc = locale as Locale

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </div>
        <Link href={ROUTES.VENDOR_ORDERS(loc)}>
          <Button variant="ghost" size="sm">
            {t('viewAll')}
            <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {orders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {t('empty')}
            </p>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <p className="font-medium font-mono text-sm">{order.id}</p>
                  <p className="text-sm text-muted-foreground">
                    {order.customer || t('unknownCustomer')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {order.createdAt
                      ? new Date(order.createdAt).toLocaleString(locale)
                      : '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold">
                    ₴{Number(order.total ?? order.netAmount ?? 0).toFixed(2)}
                  </p>
                  <Badge variant={
                    order.status === 'completed' || order.status === 'paid' ? 'default' :
                    order.status === 'processing' || order.status === 'shipped' ? 'secondary' : 'outline'
                  }>
                    {order.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
