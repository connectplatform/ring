/**
 * Vendor Dashboard - Main hub for vendor management
 * 
 * Displays key metrics, recent orders, and DAGI agent activation
 */

import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { auth } from '@/auth'
import { ROUTES } from '@/constants/routes'
import VendorDashboardWrapper from '@/components/wrappers/vendor-dashboard-wrapper'
import { DAGIActivationCard } from '@/components/vendor/dagi-activation-card'
import { DashboardStats } from '@/components/vendor/dashboard-stats'
import { RecentOrders } from '@/components/vendor/recent-orders'
import { connection } from 'next/server'

export const metadata: Metadata = {
  title: 'Vendor Dashboard | GreenFood.live',
  description: 'Manage your farm, products, orders, and AI agent',
}

export default async function VendorDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await connection() // Next.js 16: opt out of prerendering

  const { locale } = await params
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect(ROUTES.LOGIN(locale as any))
  }

  // TODO: Check vendor status via database query
  // const isVendor = await hasVendorEntity(session.user.id)
  // if (!isVendor) redirect('/vendor/start')

  return (
    <VendorDashboardWrapper locale={locale}>
      <div className="container mx-auto px-6 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Vendor Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Manage your farm operations and AI agent
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          <Suspense fallback={<div className="h-32 animate-pulse bg-muted rounded-lg" />}>
            <DashboardStats />
          </Suspense>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          <Suspense fallback={<div className="h-96 animate-pulse bg-muted rounded-lg" />}>
            <DAGIActivationCard userId={session.user.id} />
          </Suspense>

          <Suspense fallback={<div className="h-96 animate-pulse bg-muted rounded-lg" />}>
            <RecentOrders />
          </Suspense>
        </div>
      </div>
    </VendorDashboardWrapper>
  )
}
