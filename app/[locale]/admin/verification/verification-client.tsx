'use client'

import { useLocale } from 'next-intl'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
import VerificationQueuePanel from '@/features/admin/verification/verification-queue-panel'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'
import { useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/shared'

export default function AdminVerificationClient() {
  const locale = (useLocale() as Locale) || 'en'
  const tAdmin = useTranslations('modules.admin')
  const adminLabels = buildModulesAdminLabels(tAdmin)

  return (
    <AdminWrapper locale={locale} pageContext="verification" labels={adminLabels}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{tAdmin('verificationQueue.pageTitle')}</h1>
          <p className="text-muted-foreground">{tAdmin('verificationQueue.pageSubtitle')}</p>
        </div>
        <VerificationQueuePanel locale={locale} />
      </div>
    </AdminWrapper>
  )
}
