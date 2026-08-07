import React, { Suspense } from 'react'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { AdminAuthGuard } from '@/lib/auth/layout-guards/admin-auth-guard'
import { LocaleLayoutFallback } from '@/components/layout/locale-layout-fallback'

interface AdminLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  const { locale: localeParam } = await params
  const locale: Locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  return (
    <Suspense fallback={<LocaleLayoutFallback />}>
      <AdminAuthGuard locale={locale}>{children}</AdminAuthGuard>
    </Suspense>
  )
}
