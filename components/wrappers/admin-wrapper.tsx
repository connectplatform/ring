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

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import { AdminSidebarContent } from '@/components/layout/rails/admin-rail'
import type { Locale } from '@/i18n/shared'
import type { NewsStatsSummary } from '@/features/news/types'
import type { AdminPageContext } from '@/features/admin/admin-nav-config'

/** Keys aligned with `modules.admin` / admin right-rail copy (partial overrides allowed). */
export type ModulesAdminLabels = Partial<{
  dashboard: string
  users: string
  rewards: string
  news: string
  dao: string
  analytics: string
  moderation: string
  performance: string
  security: string
  fraudDesk: string
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
  crmOrders: string
  processes: string
  subscriptions: string
  web3: string
  relatedModules: string
  navGroupTrust: string
  navGroupPlatformOps: string
  newsManagement: string
  newsRailArticles: string
  newsRailCategories: string
  newsRailAnalytics: string
  newsRailBulk: string
  storeProducts: string
  storeOrders: string
  storeStock: string
  storeCommissions: string
  storeAddProduct: string
  daoPools: string
  daoCreate: string
  securityTabOverview: string
  securityTabFraud: string
  securityTabVerification: string
  securityTabEvents: string
  matcherTabAnalytics: string
  matcherTabModeration: string
  moderationTabQueue: string
  moderationTabRules: string
  moderationTabReports: string
  moderationTabAnalytics: string
  usersTabOverview: string
  usersTabUsers: string
  usersTabVerification: string
  usersTabAnalytics: string
  userManagement: string
  web3Settings: string
  web3Overview: string
  web3Nft: string
  web3NftMint: string
  quickNav: string
  navGroupOverview: string
  navGroupCommunity: string
  navGroupPlatform: string
  navGroupCommerce: string
  navGroupEmail: string
  systemStats: string
  newsStatsTotal: string
  newsStatsPublished: string
  newsStatsDrafts: string
  newsStatsArchived: string
  newsStatsViews: string
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
  pageContext?: AdminPageContext
  translations?: { modules?: { admin?: ModulesAdminLabels } }
  /** Flat admin labels (e.g. from `buildModulesAdminLabels`) — merged over `translations.modules.admin`. */
  labels?: ModulesAdminLabels
  /** Optional news-specific statistics for the admin right rail when pageContext='news'. */
  newsStats?: NewsStatsSummary
  /** When false, hide the right rail so the center pane fills available width (CRM tabs shell). */
  showRightRail?: boolean
}

export default function AdminWrapper({
  children,
  locale,
  pageContext = 'dashboard',
  translations,
  labels,
  newsStats,
  showRightRail = true,
}: AdminWrapperProps) {
  const [mounted, setMounted] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const closeRail = useCallback(() => setRightSidebarOpen(false), [])

  const rightRail = useMemo(
    () =>
      showRightRail ? (
        <AdminSidebarContent
          locale={locale}
          pageContext={pageContext}
          translations={translations}
          labels={labels}
          newsStats={newsStats}
          onNavigate={closeRail}
        />
      ) : null,
    [locale, pageContext, translations, labels, newsStats, closeRail, showRightRail],
  )

  if (!mounted) {
    return <div className="min-h-[40vh]">{children}</div>
  }

  return (
    <RingRightRailLayout
      rightRail={rightRail}
      showRightRail={showRightRail}
      flushCenterPane
      contentClassName="pb-24 lg:pb-8"
      isOpen={rightSidebarOpen}
      onToggle={setRightSidebarOpen}
    >
      <DavinciCenterPane contentClassName="space-y-6">{children}</DavinciCenterPane>
    </RingRightRailLayout>
  )
}
