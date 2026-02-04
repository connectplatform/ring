'use client'

/**
 * VENDOR START WRAPPER - Ring Platform v2.0
 * ==========================================
 * Perfect 3-column responsive layout pattern
 * Vendor onboarding with progress tracking
 * 
 * Layout Structure:
 * - Desktop: DesktopSidebar (280px) + Center Content + Right Sidebar (320px)
 * - iPad: DesktopSidebar (280px) + Center Content + Floating Toggle for Right Sidebar
 * - Mobile: Center Content + Bottom Navigation + Floating Toggle for Right Sidebar
 * 
 * Strike Team:
 * - Ring Components Specialist (architectural consistency)
 * - Tailwind CSS 4 Specialist (responsive design)
 * - React 19 Specialist (modern patterns)
 */

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import DesktopSidebar from '@/components/navigation/desktop-sidebar'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import { 
  Settings,
  Sparkles,
  TrendingUp,
  Leaf,
  DollarSign,
  BarChart3,
  BookOpen,
  CheckCircle
} from 'lucide-react'

interface VendorStartWrapperProps {
  children: React.ReactNode
  locale: string
  progressPercent?: number
}

export default function VendorStartWrapper({
  children,
  locale,
  progressPercent = 75
}: VendorStartWrapperProps) {
  const router = useRouter()
  const t = useTranslations('vendor')
  const [mounted, setMounted] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const benefits = [
    {
      icon: '🤖',
      title: t('startWrapper.benefits.aiEnrichment.title'),
      description: t('startWrapper.benefits.aiEnrichment.description'),
      color: 'emerald'
    },
    {
      icon: '💰',
      title: t('startWrapper.benefits.automatedSettlements.title'),
      description: t('startWrapper.benefits.automatedSettlements.description'),
      color: 'lime'
    },
    {
      icon: '🍃',
      title: t('startWrapper.benefits.daarRewards.title'),
      description: t('startWrapper.benefits.daarRewards.description'),
      color: 'green'
    },
    {
      icon: '📊',
      title: t('startWrapper.benefits.trustTier.title'),
      description: t('startWrapper.benefits.trustTier.description'),
      color: 'emerald'
    }
  ]

  const RightSidebarContent = () => (
    <div className="space-y-6">
      {/* Setup Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {t('startWrapper.setupProgress')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('startWrapper.storeDetails')}</span>
            <span className="text-emerald-600 font-medium">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {t('startWrapper.completeStoreInfo')}
          </p>
        </CardContent>
      </Card>

      {/* Benefits Cards */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {t('startWrapper.whyChooseGreenFood')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {benefits.map((benefit, idx) => (
            <div 
              key={idx}
              className="bg-card border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg bg-${benefit.color}-500/10 group-hover:bg-${benefit.color}-500/20 flex items-center justify-center flex-shrink-0 transition-colors`}>
                  <span className="text-lg">{benefit.icon}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium text-sm mb-1">{benefit.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            {t('startWrapper.nextSteps.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>{t('startWrapper.nextSteps.completeStore')}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="h-4 w-4 rounded-full border-2 border-muted" />
            <span>{t('startWrapper.nextSteps.uploadLogo')}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="h-4 w-4 rounded-full border-2 border-muted" />
            <span>{t('startWrapper.nextSteps.addFirstProduct')}</span>
          </div>
        </CardContent>
      </Card>

      {/* Help & Documentation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            {t('startWrapper.vendorGuide.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{t('startWrapper.vendorGuide.description')}</p>
          <Button
            variant="link"
            className="p-0 h-auto"
            onClick={() => router.push(`/${locale}/docs/vendor-guide`)}
          >
            {t('startWrapper.vendorGuide.viewGuide')}
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

        {/* Right Sidebar - Progress & Benefits (Desktop only, 1024px+) */}
        <div className="hidden lg:block w-[320px] flex-shrink-0 py-8 pr-6">
          <div className="sticky top-8">
            <RightSidebarContent />
          </div>
        </div>
      </div>

      {/* Mobile/Tablet: Floating toggle sidebar for right sidebar content */}
      <FloatingSidebarToggle
        isOpen={rightSidebarOpen}
        onToggle={setRightSidebarOpen}
        mobileWidth="90%"
        tabletWidth="380px"
      >
        <RightSidebarContent />
      </FloatingSidebarToggle>
    </div>
  )
}

