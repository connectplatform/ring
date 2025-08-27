import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { VendorDashboard } from '@/components/vendor/vendor-dashboard'
import { getVendorProfile } from '@/features/store/services/vendor-profile'
import { getVendorDashboardStats } from '@/features/store/services/vendor-stats'
import { getVendorEntity } from '@/features/entities/services/vendor-entity'

export async function generateMetadata({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'vendor.dashboard' })
  
  return {
    title: t('meta.title'),
    description: t('meta.description'),
  }
}

export default async function VendorDashboardPage({
  params,
}: {
  params: { locale: string }
}) {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect(`/${params.locale}/auth/signin`)
  }
  
  // Get user's vendor entity with efficient database-level filtering
  const vendorEntity = await getVendorEntity(session.user.id)
  
  if (!vendorEntity) {
    // No vendor store activated, redirect to onboarding
    redirect(`/${params.locale}/vendor/start`)
  }
  
  // Get vendor profile
  const vendorProfile = await getVendorProfile(vendorEntity.id)
  
  if (!vendorProfile) {
    // Profile doesn't exist, create one
    redirect(`/${params.locale}/vendor/start`)
  }
  
  // Get dashboard stats
  const stats = await getVendorDashboardStats(vendorEntity.id)
  
  const t = await getTranslations({ locale: params.locale, namespace: 'vendor.dashboard' })
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">{t('title')}</h1>
      
      <VendorDashboard
        vendor={vendorProfile}
        entity={vendorEntity}
        stats={stats}
        locale={params.locale}
      />
    </div>
  )
}

// Now using efficient getVendorEntity service with database-level filtering
