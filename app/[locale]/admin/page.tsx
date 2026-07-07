// TODO: add i18n locales

import type { Metadata } from 'next'
// Import branding, i18n, and SEO utility functions
import { getRingSeoBranding } from '@/lib/ring-config-core'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'

// Define robots meta config for admin page: block indexing, archiving, and snippets for max security
const adminRobots: Metadata['robots'] = {
  index: false,
  follow: false,
  noarchive: true,
  nosnippet: true,
  noimageindex: true,
}

import React from 'react'
// UI component imports (card, button, etc)
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
// App constants, i18n, and wrappers
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
// Import icons for admin UI sections
import {
  Users,
  FileText,
  Settings,      // TODO: Remove if unused throughout dashboard sections
  BarChart3,
  Shield,
  Database,     // TODO: Remove if unused throughout dashboard sections
  Activity,
  TrendingUp,
  Lock
} from 'lucide-react'
// Feature flag check for admin
import { isFeatureEnabledOnServer } from '@/whitelabel/features'
import { connection } from 'next/server'
import type { Locale } from '@/i18n/shared'
import { defaultLocale } from '@/i18n/shared'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'
import { auth } from '@/auth'
import { assertKnownUserRole, UserRolesArray } from '@/features/auth/user-role'

// --- Next.js 16 & React 19: Metadata Management ---
// TODO: Full migration for document metadata to React 19: use new `export const metadata = ...`
// Current function is not called; kept for fallback or reference only.
/*
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  // Fetch params asynchronously because Next.js 16 delivers them as a Promise
  const { locale: localeParam } = await params
  // Ensure locale is valid or fallback to default
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  const t = await getTranslations('modules.admin')
  // Build and return localized metadata config for SEO/robots headers
  return buildLocalizedMetadata({
    locale,
    path: 'admin',
    pathname: '/admin',
    fallback: {
      title: `${t('title')} | ${getRingSeoBranding().siteName}`,
      description: t('userManagementDescription'),
    },
    robots: adminRobots,
  })
}
*/
// See below for React 19 native meta usage

// --- Main Admin Dashboard Page Component ---
// TODO: Consider switching to `export default function Page()` with React 19 and Next.js 16 file conventions (if applicable).
export default async function AdminDashboardPage({
  params
}: {
  params: Promise<{ locale: string }>
}) {
  // Opt out of prerendering: required for correct server auth/session
  await connection()

  // Feature flag: Hide entire page if 'admin' feature is disabled
  if (!isFeatureEnabledOnServer('admin')) {
    // If admin is not enabled, show nothing - security best practice
    return null
  }

  // Await params (Next.js 16 passes these as a Promise)
  const { locale } = await params

  // Ensure the locale is valid, fallback if not
  const validLocale: Locale =
    routing.locales.includes(locale as Locale) ? (locale as Locale) : (defaultLocale as Locale)

  // Set translation locale for current request for server-rendered translations
  setRequestLocale(validLocale)

  // Fetch translations for admin module
  const t = await getTranslations('modules.admin')

  // Build admin dashboard labels based on translations (sidebar etc)
  const adminLabels = buildModulesAdminLabels(t)

  // Fetch user session (for RBAC and page personalization)
  const session = await auth()

  // Determine if user is SUPERADMIN (for additional admin features)
  const isSuperadmin =
    assertKnownUserRole(session?.user?.role as UserRolesArray) === UserRolesArray.superadmin

  // NOTE: Auth is also enforced server-side by app/[locale]/admin/layout.tsx → AdminAuthGuard

  // Compose page-level metadata for React 19 document head (title, description, canonical, etc)
  const title = `${t('title')} | Ring Platform`
  const description = t('userManagementDescription')
  const canonicalUrl = `${process.env.NEXT_PUBLIC_API_URL}${ROUTES.ADMIN(validLocale)}`

  // --- Admin Section Navigation Tiles Configuration ---
  // Each entry corresponds to a dashboard card on UI
  const adminSections = [
    {
      title: t('userManagement'),
      description: t('userManagementDescription'),
      href: ROUTES.ADMIN_USERS(validLocale),
      icon: Users,
      color: 'bg-blue-500',
      stats: 'User accounts, roles, and access control'
    },
    {
      title: t('newsManagement'),
      description: t('newsManagementDescription'),
      href: ROUTES.ADMIN_NEWS(validLocale),
      icon: FileText,
      color: 'bg-green-500',
      stats: 'Create, edit, and publish news articles'
    },
    {
      title: 'System Analytics',
      description: 'Monitor platform performance and user engagement', // TODO: Translation hardcoded, add i18n support
      href: ROUTES.ADMIN_ANALYTICS(validLocale),
      icon: BarChart3,
      color: 'bg-purple-500',
      stats: 'Web Vitals, performance metrics, user analytics'
    },
    {
      title: 'Identity Verification',
      description: 'Review KYC and entity verification procedures', // TODO: Translation hardcoded, add i18n support
      href: ROUTES.ADMIN_VERIFICATION(validLocale),
      icon: Shield,
      color: 'bg-teal-500',
      stats: 'KYC, entity identity, vendor store verification queue'
    },
    {
      title: 'Content Moderation',
      description: 'Advanced content filtering and community management', // TODO: Translation hardcoded, add i18n support
      href: `${ROUTES.ADMIN(validLocale)}/moderation`,
      icon: Shield,
      color: 'bg-orange-500',
      stats: 'Auto-moderation rules, user reports, content review'
    },
    {
      title: 'Security & Audit',
      description: 'Security monitoring and compliance tracking', // TODO: Translation hardcoded, add i18n support
      href: ROUTES.ADMIN_SECURITY(validLocale),
      icon: Lock,
      color: 'bg-red-500',
      stats: 'Authentication monitoring, permission audits, security events'
    },
    // Only show processes dashboard link for superadmins
    ...(isSuperadmin
      ? [
          {
            title: t('processes.dashboardTitle'),
            description: t('processes.dashboardDescription'),
            href: ROUTES.ADMIN_PROCESSES(validLocale),
            icon: Activity,
            color: 'bg-indigo-500',
            stats: t('processes.dashboardStats'),
          },
        ]
      : []),
  ]

  // --- Render Admin Dashboard UI ---
  return (
    <>
      {/* --- Document Metadata (hoisted to <head> by React 19) --- */}
      {/* TODO: Consider refactor to `export const metadata = ...` approach; see https://nextjs.org/docs/app/building-your-application/optimizing/metadata for full codemod */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />

      {/* OpenGraph SEO metadata for social previews */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content={validLocale === 'uk' ? 'uk_UA' : validLocale === 'ru' ? 'ru_UA' : 'en_US'} />
      <meta property="og:alternate_locale" content={validLocale === 'uk' ? 'en_US' : validLocale === 'ru' ? 'en_US' : 'uk_UA'} />

      {/* Twitter card social meta */}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />

      {/* Admin-deny robots/security meta */}
      <meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex" />
      <meta name="googlebot" content="noindex, nofollow, noarchive, nosnippet, noimageindex" />
      {/* Enforce strict referrer policy for additional privacy on admin routes */}
      <meta name="referrer" content="no-referrer" />

      {/* Structured data: Admin dashboard schema.org metadata for analytics/search (minimal exposure) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": "Admin Dashboard - Ring Platform",
            "description": description,
            "url": canonicalUrl,
            "mainEntity": {
              "@type": "WebPageElement",
              "name": "Administrative Dashboard",
              "description": "Platform management and monitoring interface"
            },
            "breadcrumb": {
              "@type": "BreadcrumbList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "name": "Home",
                  "item": "https://ring-platform.org"
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": "Admin Dashboard",
                  "item": canonicalUrl
                }
              ]
            },
            "accessMode": "restricted",
            "accessibilityControl": "authentication"
          })
        }}
      />

      {/* --- Admin Page Main Content --- */}
      <AdminWrapper locale={validLocale} pageContext="dashboard" labels={adminLabels}>
        <div className="container mx-auto px-0 py-0">
          {/* Page Heading and Description */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {t('title')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {t('userManagementDescription')}
            </p>
          </div>

          {/* --- Quick Stats Cards --- */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* MOCK CODE, TODO: Replace static values below with live API or server metrics for dashboard at scale.
                1. Add API fetch or SSR logic for stats (users, articles, etc)
                2. Replace hardcoded numbers and % with live data
            */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">1,234</div>
                <p className="text-xs text-muted-foreground">+12% from last month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Published Articles</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">89</div>
                <p className="text-xs text-muted-foreground">+5 this week</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">456</div>
                <p className="text-xs text-muted-foreground">Real-time</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Health</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">99.9%</div>
                <p className="text-xs text-muted-foreground">Uptime</p>
              </CardContent>
            </Card>
          </div>

          {/* --- Admin Dashboard Navigation Tiles --- */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Render each admin section as a dashboard card with CTA */}
            {adminSections.map((section) => {
              const IconComponent = section.icon;
              return (
                <Card key={section.href} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center space-x-4">
                      <div className={`p-3 rounded-lg ${section.color}`}>
                        <IconComponent className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{section.title}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {section.description}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      {section.stats}
                    </p>
                    <Link href={section.href}>
                      <Button className="w-full">
                        Access {section.title}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* --- Recent Activity Stream (Preview) --- */}
          {/* MOCK CODE, TODO: Connect this to live DB or server logs for real admin activity feed.
                1. Build recent activity API endpoint for server actions (user signup, article publish, etc)
                2. Fetch data in this page (SSR/fetch)
                3. Replace static events below with mapped events from server
          */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Example activity event #1 */}
                <div className="flex items-center space-x-4">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">New user registered</p>
                    <p className="text-xs text-muted-foreground">john.doe@example.com - 2 minutes ago</p>
                  </div>
                </div>
                {/* Example activity event #2 */}
                <div className="flex items-center space-x-4">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">News article published</p>
                    <p className="text-xs text-muted-foreground">"Platform Updates Q4 2024" - 15 minutes ago</p>
                  </div>
                </div>
                {/* Example activity event #3 */}
                <div className="flex items-center space-x-4">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">System maintenance scheduled</p>
                    <p className="text-xs text-muted-foreground">Scheduled for tomorrow 2:00 AM - 1 hour ago</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminWrapper>
    </>
  )
}

/** 
 * OBSOLETE FUNCTIONS (removed with React 19 migration):
 * - generateMetadata() function (replaced by React 19 native document metadata)
 * 
 * React 19 Native Features Used:
 * - Document metadata: <title>, <meta>, <link> tags automatically hoisted to <head>
 * - Maximum security: Enhanced noindex/nofollow/noarchive for admin pages
 * - Admin dashboard schema: Structured data with access restrictions
 * - Authentication protection: Admin role validation preserved
 * - Breadcrumb navigation: Administrative context
 * - Referrer policy: Enhanced privacy for admin pages
 * - Preserved all dashboard functionality, stats, and admin navigation
 * 
 * TODO:
 * - Replace stub/mock dashboard stats and event feed with dynamic server queries (API/fetch/SSR as relevant)
 * - Shift static metadata to React 19 `export const metadata = ...` for full Next.js 16 alignment
 * - Fully i18n hardcoded admin tile descriptions
 * - Remove unused icons from import list if not present in adminSections
 * - Preserved all dashboard functionality, stats, and admin navigation **/