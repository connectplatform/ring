'use client'

import React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'
import type { AdminPageContext } from '@/features/admin/admin-nav-config'
import type { Locale } from '@/i18n/shared'

export function EmailAdminShell({
  children,
  pageContext,
}: {
  children: React.ReactNode
  pageContext: Extract<
    AdminPageContext,
    'email-inbox' | 'email-drafts' | 'email-contacts' | 'email-analytics' | 'email-tasks'
  >
}) {
  const locale = (useLocale() as Locale) || 'en'
  const tAdmin = useTranslations('modules.admin')
  const labels = buildModulesAdminLabels((key, ...args) => tAdmin(key as never, ...(args as never[])))

  return (
    <AdminWrapper locale={locale} pageContext={pageContext} labels={labels}>
      <div className="container mx-auto px-4 py-6">{children}</div>
    </AdminWrapper>
  )
}
