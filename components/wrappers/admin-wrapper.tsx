'use client'

/**
 * ADMIN PAGE WRAPPER - Ring Platform v2.0
 * =======================================
 * Universal 3-column responsive layout for all admin pages
 *
 * Layout Structure:
 * - Desktop: DesktopSidebar (280px) + Center Content + Right Sidebar (320px)
 * - iPad: DesktopSidebar (280px) + Center Content + Floating Toggle for Right Sidebar
 * - Mobile: Center Content + Bottom Navigation + Floating Toggle for Right Sidebar
 *
 * Dynamic Right Sidebar Content based on page context:
 * - Quick Nav (admin sections)
 * - System Stats
 * - Recent Activity
 * - Admin Tools
 * - Help
 *
 * Strike Team:
 * - Ring Components Specialist (layout pattern)
 * - React 19 Specialist (modern patterns)
 * - Admin Systems Expert (contextual admin UX)
 * - Security Specialist (admin access controls)
 * - Performance Optimizer (admin dashboard efficiency)
 */

import React, { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
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
  Database,
  Server,
  Zap,
  Eye,
  Edit,
  Plus,
  Archive
} from 'lucide-react'
import { ROUTES } from '@/constants/routes'

interface AdminWrapperProps {
  children: React.ReactNode
  locale: string
  pageContext?: 'dashboard' | 'users' | 'news' | 'analytics' | 'moderation' | 'performance' | 'security' | 'settings' | 'matcher' | 'store'
  translations?: any // Pass translations from parent component
}

export default function AdminWrapper({
  children,
  locale,
  pageContext = 'dashboard',
  translations
}: AdminWrapperProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  // Use passed translations or fallback to default object
  const t = translations?.modules?.admin || {
    // Fallback translations if none provided
    'dashboard': 'Dashboard',
    'users': 'Users',
    'news': 'News',
    'analytics': 'Analytics',
    'moderation': 'Moderation',
    'performance': 'Performance',
    'security': 'Security',
    'settings': 'Settings',
    'matcher': 'Matcher',
    'store': 'Store',
    'quickNav': 'Quick Navigation',
    'systemStats': 'System Stats',
    'totalUsers': 'Total Users',
    'publishedArticles': 'Published',
    'activeUsers': 'Active Users',
    'newUsers': 'New Today',
    'uptime': 'Uptime',
    'recentActivity': 'Recent Activity',
    'viewAllActivity': 'View All Activity',
    'adminTools': 'Admin Tools',
    'contextualTools': 'Context-specific tools for this page',
    'helpDocs': 'Help & Docs',
    'adminHelpDescription': 'Get help with admin tasks and platform management.',
    'bulkImport': 'Bulk Import',
    'exportData': 'Export Data',
    'userReports': 'User Reports',
    'bulkPublish': 'Bulk Publish',
    'seoTools': 'SEO Tools',
    'contentModeration': 'Content Moderation',
    'inventorySync': 'Inventory Sync',
    'orderManagement': 'Order Management',
    'productAnalytics': 'Product Analytics',
    'systemBackup': 'System Backup',
    'cacheClear': 'Clear Cache',
    'viewLogs': 'View Logs',
    'gettingStarted': 'Getting Started',
    'apiReference': 'API Reference',
    'troubleshooting': 'Troubleshooting'
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  // Admin navigation sections
  const adminSections = [
    {
      id: 'dashboard',
      label: t['dashboard'] || 'Dashboard',
      icon: BarChart3,
      href: `/${locale}/admin`,
      active: pageContext === 'dashboard'
    },
    {
      id: 'users',
      label: t['users'] || 'Users',
      icon: Users,
      href: `/${locale}/admin/users`,
      active: pageContext === 'users'
    },
    {
      id: 'news',
      label: t['news'] || 'News',
      icon: FileText,
      href: `/${locale}/admin/news`,
      active: pageContext === 'news'
    },
    {
      id: 'analytics',
      label: t['analytics'] || 'Analytics',
      icon: TrendingUp,
      href: `/${locale}/admin/analytics`,
      active: pageContext === 'analytics'
    },
    {
      id: 'moderation',
      label: t['moderation'] || 'Moderation',
      icon: Shield,
      href: `/${locale}/admin/moderation`,
      active: pageContext === 'moderation'
    },
    {
      id: 'performance',
      label: t['performance'] || 'Performance',
      icon: Zap,
      href: `/${locale}/admin/performance`,
      active: pageContext === 'performance'
    },
    {
      id: 'security',
      label: t['security'] || 'Security',
      icon: Shield,
      href: `/${locale}/admin/security`,
      active: pageContext === 'security'
    },
    {
      id: 'settings',
      label: t['settings'] || 'Settings',
      icon: Settings,
      href: `/${locale}/admin/settings`,
      active: pageContext === 'settings'
    },
    {
      id: 'matcher',
      label: t['matcher'] || 'Matcher',
      icon: Database,
      href: `/${locale}/admin/matcher`,
      active: pageContext === 'matcher'
    },
    {
      id: 'store',
      label: t['store'] || 'Store',
      icon: Archive,
      href: `/${locale}/admin/store`,
      active: pageContext === 'store'
    },
  ]

  // Mock system stats (will be dynamic later)
  const systemStats = {
    users: { total: 15420, active: 8920, new: 245 },
    articles: { total: 1234, published: 987, drafts: 89 },
    orders: { total: 5678, pending: 123, completed: 5234 },
    performance: { uptime: 99.9, responseTime: 145, errors: 3 }
  }

  // Mock recent activity (will be dynamic later)
  const recentActivity = [
    { id: '1', type: 'user_registered', message: 'New user registered: john@example.com', time: '2 min ago', icon: Users },
    { id: '2', type: 'article_published', message: 'Article "Platform Updates" published', time: '15 min ago', icon: FileText },
    { id: '3', type: 'order_completed', message: 'Order #12345 completed', time: '1 hour ago', icon: CheckCircle },
    { id: '4', type: 'security_alert', message: 'Failed login attempt detected', time: '2 hours ago', icon: AlertTriangle },
    { id: '5', type: 'user_banned', message: 'User account suspended', time: '3 hours ago', icon: Shield },
  ]

  // Context-specific admin tools
  const getContextualTools = () => {
    switch (pageContext) {
      case 'users':
        return [
          { id: 'bulk_import', label: t['bulkImport'] || 'Bulk Import', icon: Plus },
          { id: 'export_data', label: t['exportData'] || 'Export Data', icon: Archive },
          { id: 'user_reports', label: t['userReports'] || 'User Reports', icon: BarChart3 },
        ]
      case 'news':
        return [
          { id: 'bulk_publish', label: t['bulkPublish'] || 'Bulk Publish', icon: Plus },
          { id: 'seo_tools', label: t['seoTools'] || 'SEO Tools', icon: TrendingUp },
          { id: 'content_moderation', label: t['contentModeration'] || 'Content Moderation', icon: Shield },
        ]
      case 'store':
        return [
          { id: 'inventory_sync', label: t['inventorySync'] || 'Inventory Sync', icon: Database },
          { id: 'order_management', label: t['orderManagement'] || 'Order Management', icon: Archive },
          { id: 'product_analytics', label: t['productAnalytics'] || 'Product Analytics', icon: BarChart3 },
        ]
      default:
        return [
          { id: 'system_backup', label: t['systemBackup'] || 'System Backup', icon: Database },
          { id: 'cache_clear', label: t['cacheClear'] || 'Clear Cache', icon: Zap },
          { id: 'logs_view', label: t['viewLogs'] || 'View Logs', icon: Eye },
        ]
    }
  }

  const RightSidebarContent = () => (
    <div className="space-y-6">
      {/* Quick Navigation Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {t['quickNav'] || 'Quick Navigation'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {adminSections.map((section) => (
            <Button
              key={section.id}
              variant={section.active ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => {
                router.push(section.href)
                setRightSidebarOpen(false)
              }}
            >
              <section.icon className="h-4 w-4 mr-2" />
              {section.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* System Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            {t['systemStats'] || 'System Stats'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{systemStats.users.total.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">{t['totalUsers'] || 'Total Users'}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{systemStats.articles.published}</div>
              <div className="text-xs text-muted-foreground">{t['publishedArticles'] || 'Published'}</div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t['activeUsers'] || 'Active Users'}</span>
              <span>{systemStats.users.active.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t['newUsers'] || 'New Today'}</span>
              <span className="text-green-600">+{systemStats.users.new}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t['uptime'] || 'Uptime'}</span>
              <span className="text-green-600">{systemStats.performance.uptime}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {t['recentActivity'] || 'Recent Activity'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentActivity.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3">
              <div className="p-1 bg-muted rounded">
                <activity.icon className="h-3 w-3" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">{activity.message}</p>
                <p className="text-xs text-muted-foreground">{activity.time}</p>
              </div>
            </div>
          ))}

          <Button
            variant="link"
            className="w-full p-0 h-auto"
            onClick={() => router.push(`/${locale}/admin/activity`)}
          >
            {t['viewAllActivity'] || 'View All Activity'} →
          </Button>
        </CardContent>
      </Card>

      {/* Admin Tools Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            {t['adminTools'] || 'Admin Tools'}
          </CardTitle>
          <CardDescription>
            {t['contextualTools'] || 'Context-specific tools for this page'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {getContextualTools().map((tool) => (
            <Button
              key={tool.id}
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                // TODO: Implement tool actions
                console.log('Tool clicked:', tool.id)
                setRightSidebarOpen(false)
              }}
            >
              <tool.icon className="h-4 w-4 mr-2" />
              {tool.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Help & Documentation Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            {t['helpDocs'] || 'Help & Docs'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{t['adminHelpDescription'] || 'Get help with admin tasks and platform management.'}</p>
          <div className="space-y-2">
            <Button
              variant="link"
              className="p-0 h-auto text-sm"
              onClick={() => router.push(`/${locale}/docs/admin/getting-started`)}
            >
              {t['gettingStarted'] || 'Getting Started'} →
            </Button>
            <Button
              variant="link"
              className="p-0 h-auto text-sm"
              onClick={() => router.push(`/${locale}/docs/admin/api-reference`)}
            >
              {t['apiReference'] || 'API Reference'} →
            </Button>
            <Button
              variant="link"
              className="p-0 h-auto text-sm"
              onClick={() => router.push(`/${locale}/docs/admin/troubleshooting`)}
            >
              {t['troubleshooting'] || 'Troubleshooting'} →
            </Button>
          </div>
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

        {/* Right Sidebar - Admin Tools & Stats (Desktop only, 1024px+) */}
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
