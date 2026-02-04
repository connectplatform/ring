'use client'

/**
 * PRODUCT FORM WRAPPER - Ring Platform v2.0
 * ==========================================
 * Perfect 3-column responsive layout for product add/edit
 * 
 * Strike Team: Ring Components Specialist
 */

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import DesktopSidebar from '@/components/navigation/desktop-sidebar'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import { 
  Settings,
  Camera,
  Leaf,
  DollarSign,
  Package,
  BookOpen,
  Sparkles
} from 'lucide-react'

interface ProductFormWrapperProps {
  children: React.ReactNode
  locale: string
  mode: 'create' | 'edit'
}

export default function ProductFormWrapper({ 
  children, 
  locale,
  mode 
}: ProductFormWrapperProps) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const tips = [
    { icon: '📸', title: 'Professional Photos', description: 'Upload 1-5 high-quality photos. First photo becomes main display.' },
    { icon: '✍️', title: 'Detailed Description', description: 'Highlight benefits, features, and care instructions.' },
    { icon: '💰', title: 'Competitive Pricing', description: 'Fair prices reflecting quality and sustainability.' },
    { icon: '🌱', title: 'Regenerative Practices', description: 'Earn up to 25% DAAR bonuses for sustainability.' },
    { icon: '📦', title: 'Stock Management', description: 'Keep inventory updated to prevent overselling.' },
  ]

  const RightSidebarContent = () => (
    <div className="space-y-6">
      {/* Product Creation Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {mode === 'create' ? 'Creation Tips' : 'Editing Tips'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tips.map((tip, idx) => (
            <div key={idx} className="bg-card border border-border rounded-lg p-3 hover:bg-accent/50 transition-colors">
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0">{tip.icon}</span>
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium text-sm mb-1">{tip.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {tip.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Help Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Product Guide
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Comprehensive guide for creating compelling product listings</p>
          <Button
            variant="link"
            className="p-0 h-auto"
            onClick={() => router.push(`/${locale}/docs/vendor-guide/products`)}
          >
            View Guide →
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
            title="Creation Tips"
          >
            <Settings className="h-6 w-6" />
          </Button>
        </div>
      )}
    </div>
  )
}

