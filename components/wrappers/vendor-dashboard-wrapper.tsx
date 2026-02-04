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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import DesktopSidebar from '@/components/navigation/desktop-sidebar'
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
  const [mounted, setMounted] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const quickActions = [
    { id: 'products', label: 'Manage Products', icon: Package, href: `/${locale}/vendor/products` },
    { id: 'add-product', label: 'Add Product', icon: ShoppingBag, href: `/${locale}/vendor/products/add` },
    { id: 'orders', label: 'View Orders', icon: Users, href: `/${locale}/vendor/orders` },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, href: `/${locale}/vendor/analytics` },
  ]

  const RightSidebarContent = () => (
    <div className="space-y-6">
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Quick Actions
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
            Boost Your Sales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <span className="text-emerald-500">✓</span>
            <p>Add high-quality product photos for 3x more views</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-emerald-500">✓</span>
            <p>Update inventory daily for better search ranking</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-emerald-500">✓</span>
            <p>Highlight regenerative practices for DAAR bonuses</p>
          </div>
        </CardContent>
      </Card>

      {/* Help & Resources */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Vendor Resources
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Learn how to maximize your store's potential</p>
          <Button
            variant="link"
            className="p-0 h-auto"
            onClick={() => router.push(`/${locale}/docs/vendor-guide`)}
          >
            View Vendor Guide →
          </Button>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="min-h-screen bg-background text-foreground relative transition-colors duration-300">
      <div className="flex gap-6 min-h-screen">
        {/* Left Sidebar - Main Navigation (Desktop only) */}
        <div className="hidden md:block w-[280px] flex-shrink-0">
          <DesktopSidebar />
        </div>

        {/* Center Content Area */}
        <div className="flex-1 py-8 px-4 md:px-0 md:pr-6 lg:pb-8 pb-24">
          {children}
        </div>

        {/* Right Sidebar (Desktop only, 1024px+) */}
        <div className="hidden lg:block w-[320px] flex-shrink-0 py-8 pr-6">
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
            title="Quick Actions"
          >
            <Settings className="h-6 w-6" />
          </Button>
        </div>
      )}
    </div>
  )
}

