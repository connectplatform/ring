'use client'

/**
 * VENDOR PRODUCTS WRAPPER - Ring Platform v2.0
 * =============================================
 * Perfect 3-column responsive layout for product management
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
  Plus,
  Package,
  Eye,
  TrendingUp,
  BookOpen,
  Filter,
  Leaf
} from 'lucide-react'

interface VendorProductsWrapperProps {
  children: React.ReactNode
  locale: string
}

export default function VendorProductsWrapper({ 
  children, 
  locale 
}: VendorProductsWrapperProps) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const RightSidebarContent = () => (
    <div className="space-y-6">
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            className="w-full justify-start"
            onClick={() => {
              router.push(`/${locale}/vendor/products/add`)
              setRightSidebarOpen(false)
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Product
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              router.push(`/${locale}/vendor/dashboard`)
              setRightSidebarOpen(false)
            }}
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            View Dashboard
          </Button>
        </CardContent>
      </Card>

      {/* Product Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Leaf className="h-4 w-4" />
            Product Success Tips
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <span className="text-emerald-500">📸</span>
            <p>High-quality photos increase sales by 3x</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-emerald-500">🌱</span>
            <p>Highlight sustainability for DAAR bonuses</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-emerald-500">💰</span>
            <p>Competitive pricing attracts more buyers</p>
          </div>
        </CardContent>
      </Card>

      {/* Help & Resources */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Product Guide
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Learn how to create compelling product listings</p>
          <Button
            variant="link"
            className="p-0 h-auto"
            onClick={() => router.push(`/${locale}/docs/vendor-guide/products`)}
          >
            View Product Guide →
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

