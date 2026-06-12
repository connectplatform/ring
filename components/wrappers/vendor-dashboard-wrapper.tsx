'use client'

/**
 * VENDOR DASHBOARD WRAPPER - Ring Platform v2.0
 * ============================================== 
 * Perfect 3-column responsive layout for vendor hub
 * 
 * Strike Team: Ring Components Specialist
 */

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import { 
  Settings,
  TrendingUp,
  DollarSign,
  Package,
  Users,
  BarChart3,
  BookOpen,
  Sparkles,
  ShoppingBag
} from 'lucide-react'

interface VendorDashboardWrapperProps {
  children: React.ReactNode
  locale: string
}

export default function VendorDashboardWrapper({ 
  children, 
  locale 
}: VendorDashboardWrapperProps) {
  const router = useRouter()
  const t = useTranslations('vendor.dashboard')
  const [mounted, setMounted] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const quickActions = [
    { id: 'products', label: t('quickActions.manageProducts'), icon: Package, href: `/${locale}/vendor/products` },
    { id: 'add-product', label: t('quickActions.addProduct'), icon: ShoppingBag, href: `/${locale}/vendor/products/add` },
    { id: 'orders', label: t('quickActions.viewOrders'), icon: Users, href: `/${locale}/vendor/orders` },
    { id: 'stock', label: t('quickActions.stockLevels'), icon: Package, href: `/${locale}/vendor/stock` },
    { id: 'earnings', label: t('quickActions.earnings'), icon: DollarSign, href: `/${locale}/vendor/earnings` },
    { id: 'settings', label: t('quickActions.storeSettings'), icon: Settings, href: `/${locale}/vendor/settings` },
  ]

  const RightSidebarContent = () => (
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
              onClick={() => {
                router.push(action.href)
                setRightSidebarOpen(false)
              }}
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
            onClick={() => router.push(`/${locale}/docs/vendor-guide`)}
          >
            {t('viewVendorGuide')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="min-h-full text-foreground relative transition-colors duration-300">
      <div className="flex min-h-full gap-3">
        {/* Left Sidebar - Main Navigation (Desktop only) */}


        {/* Center Content Area */}
        <div className="ring-content-panel flex-1 min-w-0 pb-24 lg:pb-8">
          {children}
        </div>

        {/* Right Sidebar (Desktop only, 1024px+) */}
        <div className="ring-right-rail hidden w-[300px] shrink-0 self-stretch min-h-0 lg:block">
          <div className="sticky top-8">
            <RightSidebarContent />
          </div>
        </div>
      </div>

      {/* Mobile/Tablet: Floating toggle sidebar */}
      <FloatingSidebarToggle
        isOpen={rightSidebarOpen}
        onToggle={setRightSidebarOpen}
        mobileWidth="90%"
        tabletWidth="380px"
      >
        <RightSidebarContent />
      </FloatingSidebarToggle>

      {/* Floating Action Button (iPad & Mobile) */}
      {mounted && (
        <div className="lg:hidden fixed bottom-24 right-6 z-50">
          <Button
            size="lg"
            className="h-14 w-14 rounded-full shadow-2xl"
            onClick={() => setRightSidebarOpen(true)}
            title={t('quickActionsFab')}
          >
            <Settings className="h-6 w-6" />
          </Button>
        </div>
      )}
    </div>
  )
}

