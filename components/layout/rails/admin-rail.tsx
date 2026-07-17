'use client'

import React, { useMemo } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Link, toAppHref } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { BarChart3, HelpCircle } from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import type { NewsStatsSummary } from '@/features/news/types'
import {
  filterAdminNavByRole,
  getRailSubmenu,
  getRelatedHubs,
  getSectionTitleKey,
  isRailLinkActive,
  resolveRailSection,
  type AdminPageContext,
  type AdminNavLabelKey,
} from '@/features/admin/admin-nav-config'
import { AdminNavIcon } from '@/features/admin/admin-nav-icons'
import { resolveAdminNavLabel } from '@/features/admin/admin-labels'
import { parseUserRolesArray } from '@/features/auth/user-role'

/** Keys aligned with `modules.admin` / admin right-rail copy (partial overrides allowed). */
export type ModulesAdminLabels = Partial<Record<AdminNavLabelKey | string, string>> & {
  quickNav?: string
  relatedModules?: string
  helpDocs?: string
  adminHelpDescription?: string
  gettingStarted?: string
  apiReference?: string
  troubleshooting?: string
  systemStats?: string
  totalUsers?: string
  publishedArticles?: string
  activeUsers?: string
  newUsers?: string
  refcodes?: string
  newsManagement?: string
  newsStatsTotal?: string
  newsStatsPublished?: string
  newsStatsDrafts?: string
  newsStatsArchived?: string
  newsStatsViews?: string
}

export interface AdminSidebarContentProps {
  locale: Locale
  pageContext?: AdminPageContext
  translations?: { modules?: { admin?: ModulesAdminLabels } }
  labels?: ModulesAdminLabels
  newsStats?: NewsStatsSummary
  onNavigate?: () => void
}

const DEFAULT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  users: 'Users',
  rewards: 'Rewards',
  news: 'News',
  dao: 'Public pools',
  analytics: 'Analytics',
  moderation: 'Moderation',
  performance: 'Performance',
  security: 'Security',
  settings: 'Settings',
  matcher: 'Matcher',
  store: 'Store',
  refcodes: 'Referral rewards',
  subscriptions: 'Subscriptions',
  web3: 'Web3',
  web3Overview: 'Overview',
  web3Settings: 'Settings',
  web3Nft: 'NFT',
  web3NftMint: 'NFT mint',
  emailInbox: 'Email inbox',
  quickNav: 'Admin Menu',
  relatedModules: 'Related modules',
  navGroupOverview: 'Overview',
  navGroupCommunity: 'Community & content',
  navGroupTrust: 'Trust & safety',
  navGroupCommerce: 'Commerce & rewards',
  navGroupEmail: 'Email & CRM',
  navGroupPlatformOps: 'Platform',
  helpDocs: 'Help & docs',
  adminHelpDescription: 'Admin guides and API reference.',
  gettingStarted: 'Getting started',
  apiReference: 'API reference',
  troubleshooting: 'Troubleshooting',
  usersTabOverview: 'Overview',
  usersTabUsers: 'Users',
  usersTabVerification: 'Verification',
  usersTabAnalytics: 'Analytics',
  userManagement: 'User Management',
  fraudDesk: 'Fraud desk',
  processes: 'Background Processes',
  verification: 'Verification',
}

function labelFor(labels: ModulesAdminLabels, key: AdminNavLabelKey): string {
  return resolveAdminNavLabel(labels, key, DEFAULT_LABELS[key] ?? key)
}

export function AdminSidebarContent({
  locale,
  pageContext = 'dashboard',
  translations,
  labels: labelsProp,
  newsStats,
  onNavigate,
}: AdminSidebarContentProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const pathWithQuery = useMemo(() => {
    const search = searchParams.toString()
    return search ? `${pathname}?${search}` : pathname
  }, [pathname, searchParams])
  const { data: session } = useSession()
  const role = parseUserRolesArray(session?.user?.role)

  const labels: ModulesAdminLabels = {
    ...DEFAULT_LABELS,
    ...(translations?.modules?.admin || {}),
    ...(labelsProp || {}),
  }

  const navGroups = useMemo(() => filterAdminNavByRole(role), [role])
  const railSection = resolveRailSection(pageContext)
  const sectionLinks = railSection
    ? getRailSubmenu(railSection, locale, pathname, role)
    : []
  const relatedHubs =
    pageContext === 'dashboard'
      ? []
      : getRelatedHubs(pageContext, locale, role)

  const handleNavClick = () => {
    onNavigate?.()
  }

  const showFullQuickNav = pageContext === 'dashboard'

  return (
    <div className="flex flex-col min-h-0 text-foreground space-y-6">
      {railSection && sectionLinks.length > 0 ? (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <AdminNavIcon name="Settings" className="h-5 w-5 shrink-0" />
              {labelFor(labels, getSectionTitleKey(railSection))}
            </h2>
            <div className="space-y-1">
              {sectionLinks.map((link) => {
                const href = link.href(locale)
                const active = isRailLinkActive(link, pathWithQuery, href)
                return (
                  <Button
                    key={link.id}
                    variant={active ? 'default' : 'ghost'}
                    className="h-9 w-full justify-start"
                    asChild
                  >
                    <Link href={toAppHref(href)} onClick={handleNavClick}>
                      {link.icon ? (
                        <AdminNavIcon name={link.icon} className="mr-2 h-4 w-4" />
                      ) : null}
                      {labelFor(labels, link.labelKey)}
                    </Link>
                  </Button>
                )
              })}
            </div>
          </section>
          <Separator />
        </>
      ) : null}

      {relatedHubs.length > 0 ? (
        <>
          <section className="space-y-3">
            <h2 className="text-base font-semibold">
              {labels.relatedModules ?? DEFAULT_LABELS.relatedModules}
            </h2>
            <div className="space-y-1">
              {relatedHubs.map((hub) => (
                <Button
                  key={hub.id}
                  variant={hub.pageContext === pageContext ? 'default' : 'ghost'}
                  className="h-9 w-full justify-start"
                  asChild
                >
                  <Link href={toAppHref(hub.href(locale))} onClick={handleNavClick}>
                    <AdminNavIcon name={hub.icon} className="mr-2 h-4 w-4" />
                    {labelFor(labels, hub.labelKey)}
                  </Link>
                </Button>
              ))}
            </div>
          </section>
          <Separator />
        </>
      ) : null}

      {showFullQuickNav ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 shrink-0" />
            {labels.quickNav ?? DEFAULT_LABELS.quickNav}
          </h2>
          <div className="space-y-4">
            {navGroups.map((group, groupIndex) => (
              <div key={group.id}>
                {groupIndex > 0 ? <Separator className="mb-3" /> : null}
                <p className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {labelFor(labels, group.titleKey)}
                </p>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <Button
                      key={item.id}
                      variant={item.pageContext === pageContext ? 'default' : 'ghost'}
                      className="h-9 w-full justify-start"
                      asChild
                    >
                      <Link href={toAppHref(item.href(locale))} onClick={handleNavClick}>
                        <AdminNavIcon name={item.icon} className="mr-2 h-4 w-4" />
                        {labelFor(labels, item.labelKey)}
                      </Link>
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {pageContext === 'news' && newsStats ? (
        <>
          <Separator />
          <section className="space-y-3">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 shrink-0" />
              {labels.systemStats ?? 'News statistics'}
            </h2>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{labels.newsStatsTotal ?? 'Total articles'}</span>
                <span className="text-sm font-semibold tabular-nums">{newsStats.totalArticles.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{labels.newsStatsPublished ?? 'Published'}</span>
                <span className="text-sm font-semibold tabular-nums text-green-600 dark:text-green-400">
                  {newsStats.publishedArticles.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{labels.newsStatsDrafts ?? 'Drafts'}</span>
                <span className="text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                  {newsStats.draftArticles.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{labels.newsStatsArchived ?? 'Archived'}</span>
                <span className="text-sm font-semibold tabular-nums text-gray-500 dark:text-gray-400">
                  {newsStats.archivedArticles.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{labels.newsStatsViews ?? 'Total views'}</span>
                <span className="text-sm font-semibold tabular-nums">{newsStats.totalViews.toLocaleString()}</span>
              </div>
            </div>
          </section>
        </>
      ) : null}

      <Separator />

      <section className="space-y-2">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <HelpCircle className="h-4 w-4 shrink-0" />
          {labels.helpDocs ?? DEFAULT_LABELS.helpDocs}
        </h2>
        <p className="text-sm text-muted-foreground">
          {labels.adminHelpDescription ?? DEFAULT_LABELS.adminHelpDescription}
        </p>
        <div className="space-y-1">
          <Button
            variant="link"
            className="h-auto p-0 text-sm"
            onClick={() => {
              router.push(`${ROUTES.DOCS(locale)}/admin/getting-started`)
              onNavigate?.()
            }}
          >
            {labels.gettingStarted ?? DEFAULT_LABELS.gettingStarted} →
          </Button>
          <Button
            variant="link"
            className="h-auto p-0 text-sm"
            onClick={() => {
              router.push(`${ROUTES.DOCS(locale)}/admin/api-reference`)
              onNavigate?.()
            }}
          >
            {labels.apiReference ?? DEFAULT_LABELS.apiReference} →
          </Button>
          <Button
            variant="link"
            className="h-auto p-0 text-sm"
            onClick={() => {
              router.push(`${ROUTES.DOCS(locale)}/admin/troubleshooting`)
              onNavigate?.()
            }}
          >
            {labels.troubleshooting ?? DEFAULT_LABELS.troubleshooting} →
          </Button>
        </div>
      </section>
    </div>
  )
}
