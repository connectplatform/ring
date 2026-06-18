'use client'

/**
 * admin PAGE WRAPPER - Ring Platform v2.0
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

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Link, toAppHref } from '@/i18n/routing'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Settings,
  Users,
  BarChart3,
  Shield,
  FileText,
  Wrench,
  HelpCircle,
  TrendingUp,
  Database,
  Server,
  Zap,
  Eye,
  Edit,
  Plus,
  Archive,
  Mail,
  ListTodo
} from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'

/** Keys aligned with `modules.admin` / admin right-rail copy (partial overrides allowed). */
export type ModulesAdminLabels = Partial<{
  dashboard: string
  users: string
  news: string
  analytics: string
  moderation: string
  performance: string
  security: string
  settings: string
  matcher: string
  verification: string
  store: string
  refcodes: string
  emailInbox: string
  emailDrafts: string
  emailContacts: string
  emailAnalytics: string
  emailTasks: string
  quickNav: string
  navGroupOverview: string
  navGroupCommunity: string
  navGroupPlatform: string
  navGroupCommerce: string
  navGroupEmail: string
  systemStats: string
  totalUsers: string
  publishedArticles: string
  activeUsers: string
  newUsers: string
  uptime: string
  recentActivity: string
  viewAllActivity: string
  adminTools: string
  contextualTools: string
  helpDocs: string
  adminHelpDescription: string
  bulkImport: string
  exportData: string
  userReports: string
  bulkPublish: string
  seoTools: string
  contentModeration: string
  inventorySync: string
  orderManagement: string
  productAnalytics: string
  systemBackup: string
  cacheClear: string
  viewLogs: string
  gettingStarted: string
  apiReference: string
  troubleshooting: string
}>

interface AdminWrapperProps {
  children: React.ReactNode
  locale: Locale
  pageContext?: 'dashboard' | 'users' | 'news' | 'analytics' | 'moderation' | 'performance' | 'security' | 'settings' | 'matcher' | 'verification' | 'store' | 'refcodes' | 'email-inbox' | 'email-drafts' | 'email-contacts' | 'email-analytics' | 'email-tasks'
  translations?: { modules?: { admin?: ModulesAdminLabels } }
  /** Flat admin labels (e.g. from `buildModulesAdminLabels`) — merged over `translations.modules.admin`. */
  labels?: ModulesAdminLabels
}

export default function AdminWrapper({
  children,
  locale,
  pageContext = 'dashboard',
  translations,
  labels,
}: AdminWrapperProps) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  const defaultAdminLabels: Required<ModulesAdminLabels> = {
    dashboard: 'Dashboard',
    users: 'Users',
    news: 'News',
    analytics: 'Analytics',
    moderation: 'Moderation',
    performance: 'Performance',
    security: 'Security',
    settings: 'Settings',
    matcher: 'Matcher',
    verification: 'Verification',
    store: 'Store',
    refcodes: 'Referral Rewards',
    emailInbox: 'Email Inbox',
    emailDrafts: 'Email Drafts',
    emailContacts: 'Email Contacts',
    emailAnalytics: 'Email Analytics',
    emailTasks: 'Email Tasks',
    quickNav: 'Quick Navigation',
    navGroupOverview: 'Overview',
    navGroupCommunity: 'Community & content',
    navGroupPlatform: 'Platform operations',
    navGroupCommerce: 'Commerce & rewards',
    navGroupEmail: 'Email & CRM',
    systemStats: 'System Stats',
    totalUsers: 'Total Users',
    publishedArticles: 'Published',
    activeUsers: 'Active Users',
    newUsers: 'New Today',
    uptime: 'Uptime',
    recentActivity: 'Recent Activity',
    viewAllActivity: 'View All Activity',
    adminTools: 'Admin Tools',
    contextualTools: 'Context-specific tools for this page',
    helpDocs: 'Help & Docs',
    adminHelpDescription: 'Get help with admin tasks and platform management.',
    bulkImport: 'Bulk Import',
    exportData: 'Export Data',
    userReports: 'User Reports',
    bulkPublish: 'Bulk Publish',
    seoTools: 'SEO Tools',
    contentModeration: 'Content Moderation',
    inventorySync: 'Inventory Sync',
    orderManagement: 'Order Management',
    productAnalytics: 'Product Analytics',
    systemBackup: 'System Backup',
    cacheClear: 'Clear Cache',
    viewLogs: 'View Logs',
    gettingStarted: 'Getting Started',
    apiReference: 'API Reference',
    troubleshooting: 'Troubleshooting',
  }

  // Merge: English defaults < modules.admin from parent < explicit labels from server builders
  const t = {
    ...defaultAdminLabels,
    ...(translations?.modules?.admin || {}),
    ...(labels || {}),
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  // Admin navigation — grouped like docs sidebar sections
  type AdminNavItem = {
    id: string
    label: string
    icon: React.ComponentType<{ className?: string }>
    href: string
    active: boolean
  }

  type AdminNavGroup = {
    id: string
    title: string
    items: AdminNavItem[]
  }

  const adminNavGroups = useMemo((): AdminNavGroup[] => {
    const item = (
      id: string,
      label: string,
      icon: React.ComponentType<{ className?: string }>,
      href: string,
      active: boolean,
    ): AdminNavItem => ({ id, label, icon, href, active })

    return [
      {
        id: 'overview',
        title: t.navGroupOverview,
        items: [item('dashboard', t.dashboard, BarChart3, ROUTES.ADMIN(locale), pageContext === 'dashboard')],
      },
      {
        id: 'community',
        title: t.navGroupCommunity,
        items: [
          item('users', t.users, Users, ROUTES.ADMIN_USERS(locale), pageContext === 'users'),
          item('news', t.news, FileText, ROUTES.ADMIN_NEWS(locale), pageContext === 'news'),
          item('moderation', t.moderation, Shield, ROUTES.ADMIN_MODERATION(locale), pageContext === 'moderation'),
          item('analytics', t.analytics, TrendingUp, ROUTES.ADMIN_ANALYTICS(locale), pageContext === 'analytics'),
        ],
      },
      {
        id: 'platform',
        title: t.navGroupPlatform,
        items: [
          item('performance', t.performance, Zap, ROUTES.ADMIN_PERFORMANCE(locale), pageContext === 'performance'),
          item('security', t.security, Shield, ROUTES.ADMIN_SECURITY(locale), pageContext === 'security'),
          item('settings', t.settings, Settings, ROUTES.ADMIN_SETTINGS(locale), pageContext === 'settings'),
          item('matcher', t.matcher, Database, ROUTES.ADMIN_MATCHER(locale), pageContext === 'matcher'),
          item('verification', t.verification, Shield, ROUTES.ADMIN_VERIFICATION(locale), pageContext === 'verification'),
        ],
      },
      {
        id: 'commerce',
        title: t.navGroupCommerce,
        items: [
          item('store', t.store, Archive, ROUTES.ADMIN_STORE(locale), pageContext === 'store'),
          item('refcodes', t.refcodes, TrendingUp, ROUTES.ADMIN_REFCODES(locale), pageContext === 'refcodes'),
        ],
      },
      {
        id: 'email',
        title: t.navGroupEmail,
        items: [
          item('email-inbox', t.emailInbox, Mail, ROUTES.ADMIN_EMAIL_INBOX(locale), pageContext === 'email-inbox'),
          item('email-drafts', t.emailDrafts, Mail, ROUTES.ADMIN_EMAIL_DRAFTS(locale), pageContext === 'email-drafts'),
          item('email-contacts', t.emailContacts, Mail, ROUTES.ADMIN_EMAIL_CONTACTS(locale), pageContext === 'email-contacts'),
          item('email-analytics', t.emailAnalytics, BarChart3, ROUTES.ADMIN_EMAIL_ANALYTICS(locale), pageContext === 'email-analytics'),
          item('email-tasks', t.emailTasks, ListTodo, ROUTES.ADMIN_EMAIL_TASKS(locale), pageContext === 'email-tasks'),
        ],
      },
    ]
  }, [locale, pageContext, t])

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
    <div className="flex flex-col min-h-0 text-foreground space-y-6">
      {/* Quick Navigation */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Settings className="h-5 w-5 shrink-0" />
          {t['quickNav'] || 'Quick Navigation'}
        </h2>
        <div className="space-y-4">
          {adminNavGroups.map((group, groupIndex) => (
            <div key={group.id}>
              {groupIndex > 0 ? <Separator className="mb-3" /> : null}
              <p className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {group.title}
              </p>
              <div className="space-y-1">
                {group.items.map((section) => (
                  <Button
                    key={section.id}
                    variant={section.active ? 'default' : 'ghost'}
                    className="h-9 w-full justify-start"
                    asChild
                  >
                    <Link
                      href={toAppHref(section.href)}
                      onClick={() => setRightSidebarOpen(false)}
                    >
                      <section.icon className="mr-2 h-4 w-4" />
                      {section.label}
                    </Link>
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Separator />

      {/* Admin Tools */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Wrench className="h-4 w-4 shrink-0" />
          {t['adminTools'] || 'Admin Tools'}
        </h2>
        <p className="text-xs text-muted-foreground">{t['contextualTools'] || 'Context-specific tools for this page'}</p>
        <div className="space-y-1">
          {getContextualTools().map((tool) => (
            <Button
              key={tool.id}
              variant="outline"
              className="w-full justify-start h-9"
              onClick={() => {
                console.log('Tool clicked:', tool.id)
                setRightSidebarOpen(false)
              }}
            >
              <tool.icon className="h-4 w-4 mr-2" />
              {tool.label}
            </Button>
          ))}
        </div>
      </section>

      <Separator />

      {/* Help */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <HelpCircle className="h-4 w-4 shrink-0" />
          {t['helpDocs'] || 'Help & Docs'}
        </h2>
        <p className="text-sm text-muted-foreground">{t['adminHelpDescription'] || 'Get help with admin tasks and platform management.'}</p>
        <div className="space-y-1">
          <Button
            variant="link"
            className="h-auto p-0 text-sm"
            onClick={() => router.push(`${ROUTES.DOCS(locale)}/admin/getting-started`)}
          >
            {t.gettingStarted} →
          </Button>
          <Button
            variant="link"
            className="h-auto p-0 text-sm"
            onClick={() => router.push(`${ROUTES.DOCS(locale)}/admin/api-reference`)}
          >
            {t.apiReference} →
          </Button>
          <Button
            variant="link"
            className="h-auto p-0 text-sm"
            onClick={() => router.push(`${ROUTES.DOCS(locale)}/admin/troubleshooting`)}
          >
            {t.troubleshooting} →
          </Button>
        </div>
      </section>
    </div>
  )

  if (!mounted) {
    return <div className="min-h-[40vh]">{children}</div>
  }

  return (
    <RingRightRailLayout
      rightRail={<RightSidebarContent />}
      contentClassName="pb-24 lg:pb-8"
      isOpen={rightSidebarOpen}
      onToggle={setRightSidebarOpen}
    >
      {children}
    </RingRightRailLayout>
  )
}
