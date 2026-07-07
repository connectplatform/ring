'use client'

/**
 * VENDOR DASHBOARD RAIL - Extracted right-rail content
 * ======================================================
 * Quick actions, performance tips, and help resources for the vendor hub.
 * Used by vendor-dashboard-wrapper via RingRightRailLayout (railWidth={300}).
 */

import React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Settings,
  TrendingUp,
  DollarSign,
  Package,
  Users,
  BarChart3,
  BookOpen,
  Sparkles,
  ShoppingBag,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export interface VendorDashboardRailProps {
  locale: string
  onNavigate?: () => void
}

export function VendorDashboardRail({ locale, onNavigate }: VendorDashboardRailProps) {
  const router = useRouter()
  const t = useTranslations('vendor.dashboard')

  const quickActions = [
    { id: 'products', label: t('quickActions.manageProducts'), icon: Package, href: `/${locale}/vendor/products` },
    { id: 'add-product', label: t('quickActions.addProduct'), icon: ShoppingBag, href: `/${locale}/vendor/products/add` },
    { id: 'orders', label: t('quickActions.viewOrders'), icon: Users, href: `/${locale}/vendor/orders` },
    { id: 'stock', label: t('quickActions.stockLevels'), icon: Package, href: `/${locale}/vendor/stock` },
    { id: 'earnings', label: t('quickActions.earnings'), icon: DollarSign, href: `/${locale}/vendor/earnings` },
    { id: 'settings', label: t('quickActions.storeSettings'), icon: Settings, href: `/${locale}/vendor/settings` },
  ]

  const navigate = (href: string) => {
    router.push(href)
    onNavigate?.()
  }

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {t('quickActionsTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {quickActions.map((action) => (
            <Button
              key={action.id}
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate(action.href)}
            >
              <action.icon className="h-4 w-4 mr-2" />
              {action.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Performance Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {t('boostSalesTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <span className="text-emerald-500">✓</span>
            <p>{t('boostSalesTips.photos')}</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-emerald-500">✓</span>
            <p>{t('boostSalesTips.inventory')}</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-emerald-500">✓</span>
            <p>{t('boostSalesTips.quality')}</p>
          </div>
        </CardContent>
      </Card>

      {/* Help & Resources */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            {t('resourcesTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{t('resourcesDescription')}</p>
          <Button
            variant="link"
            className="p-0 h-auto"
            onClick={() => navigate(`/${locale}/docs/vendor-guide`)}
          >
            {t('viewVendorGuide')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
