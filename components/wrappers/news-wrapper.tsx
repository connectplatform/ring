'use client'

/**
 * NEWS MANAGEMENT WRAPPER - Ring Platform v2.0
 * ===========================================
 * Universal 3-column responsive layout for news management pages
 *
 * Layout Structure:
 * - Desktop: DesktopSidebar (280px) + Center Content + Right Sidebar (320px)
 * - iPad: DesktopSidebar (280px) + Center Content + Floating Toggle for Right Sidebar
 * - Mobile: Center Content + Bottom Navigation + Floating Toggle for Right Sidebar
 *
 * Dynamic Right Sidebar Content for News Management:
 * - Quick Nav (news sections: articles, categories, analytics)
 * - News Stats (total articles, published, draft, recent activity)
 * - Publishing Tools (bulk publish, SEO tools, RSS management)
 * - Content Moderation
 * - Help & Guidelines
 *
 * Strike Team:
 * - Ring Components Specialist (layout pattern)
 * - React 19 Specialist (modern patterns)
 * - Content Management Expert (news publishing workflow)
 * - SEO Specialist (content optimization tools)
 * - Analytics Expert (content performance metrics)
 */

import React, { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import type { Locale } from '@/i18n-config'
import DesktopSidebar from '@/components/navigation/desktop-sidebar'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Settings,
  Users,
  BarChart3,
  Shield,
  FileText,
  Activity,
  Wrench,
  HelpCircle,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Newspaper,
  Plus,
  Archive,
  Eye,
  Edit,
  Trash2,
  Search,
  Filter,
  Download,
  Upload,
  Globe,
  Rss,
  Megaphone,
  Target,
  Zap
} from 'lucide-react'

interface NewsWrapperProps {
  children: React.ReactNode
  pageContext?: 'articles' | 'categories' | 'analytics' | 'bulk' | 'create' | 'edit'
  stats?: {
    totalArticles: number
    publishedArticles: number
    draftArticles: number
    recentViews: number
  }
  translations?: any // Pass translations from parent component
}

export default function NewsWrapper({
  children,
  pageContext = 'articles',
  stats,
  translations
}: NewsWrapperProps) {
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale() as Locale

  // Use passed translations or fallback to default object
  const t = translations?.modules?.admin || {
    // Fallback translations if none provided
    'news': 'News',
    'analytics': 'Analytics',
    'bulkOperations': { title: 'Bulk Operations' },
    'quickNav': 'Quick Navigation',
    'systemStats': 'News Stats',
    'totalUsers': 'Total Articles',
    'publishedArticles': 'Published',
    'activeUsers': 'Drafts',
    'newUsers': 'Views (24h)',
    'uptime': 'Uptime',
    'recentActivity': 'Recent Activity',
    'viewAllActivity': 'View All Activity',
    'adminTools': 'Publishing Tools',
    'contextualTools': 'Context-specific tools for this page',
    'helpDocs': 'Help & Guidelines',
    'adminHelpDescription': 'Get help with content management and publishing workflows.',
    'bulkPublish': 'Bulk Publish',
    'seoTools': 'SEO Tools',
    'contentModeration': 'RSS Management'
  }

  // Handle responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
      // Auto-close sidebar on mobile
      if (window.innerWidth < 768) {
        setIsRightSidebarOpen(false)
      }
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Navigation items for news management
  const newsNavItems = [
    {
      id: 'articles',
      label: t.news || 'News',
      icon: Newspaper,
      href: `/${locale}/admin/news`,
      active: pageContext === 'articles' || (!pageContext && pathname?.endsWith('/news'))
    },
    {
      id: 'categories',
      label: t.newsCategories?.title || 'Categories',
      icon: Archive,
      href: `/${locale}/admin/news/categories`,
      active: pageContext === 'categories' || pathname?.includes('/categories')
    },
    {
      id: 'analytics',
      label: t.analytics || 'Analytics',
      icon: BarChart3,
      href: `/${locale}/admin/news/analytics`,
      active: pageContext === 'analytics' || pathname?.includes('/analytics')
    },
    {
      id: 'bulk',
      label: t.bulkOperations?.title || 'Bulk Operations',
      icon: Upload,
      href: `/${locale}/admin/news/bulk`,
      active: pageContext === 'bulk' || pathname?.includes('/bulk')
    }
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <DesktopSidebar />

      {/* Main Content Area */}
      <div className="lg:pl-64">
        <div className="flex min-h-screen">
          {/* Center Content */}
          <main className="flex-1 lg:pr-80">
            <div className="container mx-auto p-4 lg:p-8">
              {children}
            </div>
          </main>

          {/* Right Sidebar - Desktop */}
          <aside className="hidden lg:block fixed right-0 top-0 h-full w-80 bg-card border-l border-border overflow-y-auto">
            <NewsManagementSidebar
              navItems={newsNavItems}
              stats={stats}
              pageContext={pageContext}
              locale={locale}
              translations={translations}
              t={t}
            />
          </aside>

          {/* Right Sidebar - Mobile Overlay */}
          {isRightSidebarOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div className="absolute inset-0 bg-black/50" onClick={() => setIsRightSidebarOpen(false)} />
              <aside className="absolute right-0 top-0 h-full w-80 bg-card border-l border-border overflow-y-auto">
                <NewsManagementSidebar
                  navItems={newsNavItems}
                  stats={stats}
                  pageContext={pageContext}
                  locale={locale}
                  translations={translations}
                  t={t}
                />
              </aside>
            </div>
          )}
        </div>
      </div>

      {/* Floating Sidebar Toggle - Mobile */}
      <FloatingSidebarToggle
        isOpen={isRightSidebarOpen}
        onToggle={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
        className="lg:hidden"
      >
        <NewsManagementSidebar
          navItems={newsNavItems}
          stats={stats}
          pageContext={pageContext}
          locale={locale}
          translations={translations}
          t={t}
        />
      </FloatingSidebarToggle>
    </div>
  )
}

// News Management Sidebar Component
function NewsManagementSidebar({
  navItems,
  stats,
  pageContext,
  locale,
  translations,
  t
}: {
  navItems: any[]
  stats?: any
  pageContext: string
  locale: Locale
  translations?: any
  t: any
}) {
  return (
    <div className="p-6 space-y-6">
      {/* Quick Navigation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="w-4 h-4" />
            {t.quickNav || 'Quick Navigation'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {navItems.map((item) => (
            <Button
              key={item.id}
              variant={item.active ? "secondary" : "ghost"}
              size="sm"
              className="w-full justify-start"
              onClick={() => window.location.href = item.href}
            >
              <item.icon className="w-4 h-4 mr-2" />
              {item.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* News Statistics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            {t.systemStats || 'News Stats'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                {t.totalUsers || 'Total Articles'}
              </span>
              <Badge variant="secondary">{stats?.totalArticles || 0}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                {t.publishedArticles || 'Published'}
              </span>
              <Badge variant="default">{stats?.publishedArticles || 0}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                {t.activeUsers || 'Drafts'}
              </span>
              <Badge variant="outline">{stats?.draftArticles || 0}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                {t.newUsers || 'Views (24h)'}
              </span>
              <Badge variant="secondary">{stats?.recentViews || 0}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Publishing Tools */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Megaphone className="w-4 h-4" />
            {t.adminTools || 'Publishing Tools'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" size="sm" className="w-full justify-start">
            <Plus className="w-4 h-4 mr-2" />
            {t.bulkPublish || 'Bulk Publish'}
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start">
            <Target className="w-4 h-4 mr-2" />
            {t.seoTools || 'SEO Tools'}
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start">
            <Rss className="w-4 h-4 mr-2" />
            {t.contentModeration || 'RSS Management'}
          </Button>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="w-4 h-4" />
            {t.recentActivity || 'Recent Activity'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Article "Breaking News" published 2 hours ago
          </div>
          <div className="text-xs text-muted-foreground">
            Category "Technology" updated 4 hours ago
          </div>
          <div className="text-xs text-muted-foreground">
            15 articles moderated today
          </div>
        </CardContent>
      </Card>

      {/* Help & Guidelines */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <HelpCircle className="w-4 h-4" />
            {t.helpDocs || 'Help & Guidelines'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {t.adminHelpDescription || 'Get help with content management and publishing workflows.'}
          </p>
          <div className="space-y-1">
            <Button variant="link" size="sm" className="p-0 h-auto text-xs">
              📝 Content Guidelines →
            </Button>
            <Button variant="link" size="sm" className="p-0 h-auto text-xs">
              🎯 SEO Best Practices →
            </Button>
            <Button variant="link" size="sm" className="p-0 h-auto text-xs">
              📊 Analytics Guide →
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
