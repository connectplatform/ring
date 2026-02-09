import React from 'react';
import { redirect } from 'next/navigation';
import { auth } from "@/auth"
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { isValidLocale, defaultLocale, loadTranslations } from '@/i18n-config';
import AdminWrapper from '@/components/wrappers/admin-wrapper';
import {
  Users,
  FileText,
  Settings,
  BarChart3,
  Shield,
  Database,
  Activity,
  TrendingUp,
  Lock
} from 'lucide-react';
import { isFeatureEnabledOnServer } from '@/whitelabel/features'
import { connection } from 'next/server'


export default async function AdminDashboardPage({ 
  params 
}: {
  params: Promise<{ locale: string }>
}) {
  await connection() // Next.js 16: opt out of prerendering

  if (!isFeatureEnabledOnServer('admin')) {
    return null
  }
  const { locale } = await params;
  const validLocale = isValidLocale(locale) ? locale : defaultLocale;
  const t = await loadTranslations(validLocale);
  
  // Check authentication and admin role
  const session = await auth();
  
  if (!session?.user) {
    redirect(`/${validLocale}/login?callbackUrl=/${validLocale}/admin`);
  }

  // Check if user has admin role
  if (session.user.role !== 'admin') {
    redirect(`/${validLocale}/unauthorized`);
  }

  // React 19 metadata for admin pages
  const title = `${(t as any).admin?.dashboard || 'Admin Dashboard'} | Ring Platform`;
  const description = (t as any).admin?.dashboardDescription || 'Administrative dashboard for Ring Platform management and monitoring.';
  const canonicalUrl = `${process.env.NEXT_PUBLIC_API_URL}/${validLocale}/admin`;

  const adminSections = [
    {
      title: (t as any).admin?.userManagement || 'User Management',
      description: (t as any).admin?.userManagementDescription || 'Manage user accounts and permissions',
      href: `/${validLocale}/admin/users`,
      icon: Users,
      color: 'bg-blue-500',
      stats: 'User accounts, roles, and access control'
    },
    {
      title: (t as any).admin?.newsManagement || 'News Management',
      description: (t as any).admin?.newsManagementDescription || 'Manage news articles and content',
      href: `/${validLocale}/admin/news`,
      icon: FileText,
      color: 'bg-green-500',
      stats: 'Create, edit, and publish news articles'
    },
    {
      title: 'System Analytics',
      description: 'Monitor platform performance and user engagement',
      href: `/${validLocale}/admin/analytics`,
      icon: BarChart3,
      color: 'bg-purple-500',
      stats: 'Web Vitals, performance metrics, user analytics'
    },
    {
      title: 'Content Moderation',
      description: 'Advanced content filtering and community management',
      href: `/${validLocale}/admin/moderation`,
      icon: Shield,
      color: 'bg-orange-500',
      stats: 'Auto-moderation rules, user reports, content review'
    },
    {
      title: 'Security & Audit',
      description: 'Security monitoring and compliance tracking',
      href: `/${validLocale}/admin/security`,
      icon: Lock,
      color: 'bg-red-500',
      stats: 'Authentication monitoring, permission audits, security events'
    }
  ];

  return (
    <>
      {/* React 19 Native Document Metadata - Admin Page */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      
      {/* OpenGraph metadata */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content={validLocale === 'uk' ? 'uk_UA' : 'en_US'} />
      <meta property="og:alternate_locale" content={validLocale === 'uk' ? 'en_US' : 'uk_UA'} />
      
      {/* Twitter Card metadata */}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      
      {/* Admin page specific meta tags - Maximum security */}
      <meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex" />
      <meta name="googlebot" content="noindex, nofollow, noarchive, nosnippet, noimageindex" />
      <meta name="referrer" content="no-referrer" />
      
      {/* Admin dashboard structured data */}
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
                  "item": "https://ring.ck.ua"
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

      <AdminWrapper locale={validLocale} pageContext="dashboard">
        <div className="container mx-auto px-0 py-0">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {(t as any).admin?.dashboard || 'Admin Dashboard'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {(t as any).admin?.dashboardDescription || 'Administrative dashboard for Ring Platform management and monitoring.'}
            </p>
          </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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

        {/* Admin Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

        {/* Recent Activity */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">New user registered</p>
                  <p className="text-xs text-muted-foreground">john.doe@example.com - 2 minutes ago</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">News article published</p>
                  <p className="text-xs text-muted-foreground">"Platform Updates Q4 2024" - 15 minutes ago</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
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
  );
}

/* 
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
 */ 