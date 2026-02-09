import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { loadTranslations } from '@/i18n-config'
import { getVendorEntity } from '@/features/entities/services/vendor-entity'
import VendorStartWrapper from '@/components/wrappers/vendor-start-wrapper'
import VendorOnboardingForm from './vendor-onboarding-form'
import { connection } from 'next/server'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await connection() // Next.js 16: opt out of prerendering

  const { locale } = await params
  const t = await loadTranslations(locale as 'en' | 'uk' | 'ru')

  return {
    title: t.vendor.startPage.title,
    description: t.vendor.startPage.subtitle,
  }
}

export default async function VendorStartPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await connection() // Next.js 16: opt out of prerendering

  const { locale } = await params
  const session = await auth()
  const t = await loadTranslations(locale as 'en' | 'uk' | 'ru')

  // Require authentication
  if (!session?.user?.id) {
    redirect(ROUTES.LOGIN(locale as any))
  }

  // Check if already has vendor entity
  const existingVendor = await getVendorEntity(session.user.id)

  if (existingVendor) {
    // Already a vendor, redirect to dashboard
    redirect(`/${locale}/vendor/dashboard`)
  }

  // TODO: Check if user has MEMBER+ role
  // For now, allow all authenticated users

  return (
    <VendorStartWrapper locale={locale} progressPercent={75}>
      {/* Content Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm mb-8">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t.vendor.startPage.title}</h1>
              <p className="text-muted-foreground">
                {t.vendor.startPage.subtitle}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 max-w-4xl">
        <VendorOnboardingForm locale={locale} translations={t} />
      </div>
    </VendorStartWrapper>
  )
}

