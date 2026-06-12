'use client'

/**
 * OPPORTUNITIES PAGE WRAPPER - Ring Platform v2.0
 * ===============================================
 * Matches Profile page layout architecture
 * 
 * Layout Structure:
 * - Desktop: DesktopSidebar (280px) + Center Content + Right Sidebar (320px)
 * - iPad: DesktopSidebar (280px) + Center Content + Floating Toggle for Right Sidebar
 * - Mobile: Center Content + Bottom Navigation + Floating Toggle for Right Sidebar
 * 
 * Strike Team:
 * - Tailwind CSS 4 Specialist (layout & responsive design)
 * - React 19 Specialist (modern patterns)
 * - UI/UX Optimization Agent (mobile-first excellence)
 * - Ring Backend Administrator (opportunities domain expertise)
 */

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/shared'
import { useSession } from 'next-auth/react'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Target, 
  TrendingUp, 
  Users, 
  Briefcase, 
  Search,
  Heart,
  Eye,
  Clock,
  Settings,
  Filter,
  BookOpen,
  Sparkles
} from 'lucide-react'
import { ROUTES } from '@/constants/routes'

interface OpportunitiesPageWrapperProps {
  children: React.ReactNode
  locale: string
  searchParams: { [key: string]: string | string[] | undefined }
}

export default function OpportunitiesPageWrapper({ 
  children, 
  locale, 
  searchParams 
}: OpportunitiesPageWrapperProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const t = useTranslations('modules.opportunities')
  const tCommon = useTranslations('common')
  const [mounted, setMounted] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Quick stats for sidebar (will be dynamic later)
  const stats = {
    total: 0,
    saved: 0,
    applied: 0,
    views: 0
  }

  // Quick actions for right sidebar
  const quickActions = [
    { id: 'browse', label: t('browseOpportunities', { defaultValue: 'Browse All' }), icon: Search, href: ROUTES.OPPORTUNITIES(locale as Locale) },
    { id: 'drafts', label: t('draftOpportunities', { defaultValue: 'Drafts' }), icon: Heart, href: `${ROUTES.MY_OPPORTUNITIES(locale as Locale)}?view=drafts` },
    { id: 'pending', label: t('pendingOpportunities', { defaultValue: 'Pending' }), icon: Target, href: `${ROUTES.MY_OPPORTUNITIES(locale as Locale)}?view=pending` },
    { id: 'active', label: t('activeOpportunities', { defaultValue: 'Active' }), icon: Briefcase, href: `${ROUTES.MY_OPPORTUNITIES(locale as Locale)}?view=active` },
  ]

  // Filter categories for sidebar
  const categories = [
    { id: 'all', label: t('allCategories', { defaultValue: 'All Categories' }), count: 0 },
    { id: 'partnership', label: t('partnership', { defaultValue: 'Partnership' }), count: 0 },
    { id: 'investment', label: t('investment', { defaultValue: 'Investment' }), count: 0 },
    { id: 'sales', label: t('sales', { defaultValue: 'Sales' }), count: 0 },
    { id: 'procurement', label: t('procurement', { defaultValue: 'Procurement' }), count: 0 },
  ]

  const RightSidebarContent = () => (
    <div className="space-y-6">
      {/* Quick Stats Card */}
      {session?.user && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {t('yourActivity', { defaultValue: 'Your Activity' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('saved', { defaultValue: 'Saved' })}</span>
              <Badge variant="secondary">{stats.saved}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('applied', { defaultValue: 'Applied' })}</span>
              <Badge variant="secondary">{stats.applied}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('views', { defaultValue: 'Views' })}</span>
              <Badge variant="secondary">{stats.views}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {t('quickActions', { defaultValue: 'Quick Actions' })}
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

      {/* Categories Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            {t('categories', { defaultValue: 'Categories' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {categories.map((category) => (
            <button
              key={category.id}
              className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm hover:bg-accent transition-colors"
              onClick={() => {
                // TODO: Implement category filtering
                setRightSidebarOpen(false)
              }}
            >
              <span>{category.label}</span>
              <Badge variant="secondary" className="text-xs">{category.count}</Badge>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Help & Resources */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            {t('helpResources', { defaultValue: 'Help & Resources' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{t('opportunitiesHelp', { defaultValue: 'Learn how to find and apply to opportunities effectively.' })}</p>
          <Button
            variant="link"
            className="p-0 h-auto"
            onClick={() => router.push(`/${locale}/docs/opportunities`)}
          >
            {t('viewGuide', { defaultValue: 'View Guide' })} →
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

        {/* Right Sidebar - Filters & Actions (Desktop only, 1024px+) */}
        <div className="ring-right-rail hidden w-[300px] shrink-0 self-stretch min-h-0 lg:block">
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

