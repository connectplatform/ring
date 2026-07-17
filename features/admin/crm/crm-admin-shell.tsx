'use client'

import React from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'
import type { AdminPageContext } from '@/features/admin/admin-nav-config'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import { cn } from '@/lib/utils'

export type CrmPageContext = Extract<
  AdminPageContext,
  | 'crm-orders'
  | 'crm-inbox'
  | 'crm-drafts'
  | 'crm-contacts'
  | 'crm-analytics'
  | 'crm-tasks'
>

const CRM_TABS: Array<{ id: CrmPageContext; href: (locale: Locale) => string; labelKey: string }> = [
  { id: 'crm-orders', href: ROUTES.ADMIN_CRM_ORDERS, labelKey: 'crmOrders' },
  { id: 'crm-inbox', href: ROUTES.ADMIN_CRM_INBOX, labelKey: 'emailInbox' },
  { id: 'crm-drafts', href: ROUTES.ADMIN_CRM_DRAFTS, labelKey: 'emailDrafts' },
  { id: 'crm-contacts', href: ROUTES.ADMIN_CRM_CONTACTS, labelKey: 'emailContacts' },
  { id: 'crm-tasks', href: ROUTES.ADMIN_CRM_TASKS, labelKey: 'emailTasks' },
  { id: 'crm-analytics', href: ROUTES.ADMIN_CRM_ANALYTICS, labelKey: 'emailAnalytics' },
]

/**
 * Shared CRM shell — full-width center pane with horizontal tabs (no right rail).
 */
export function CrmAdminShell({
  children,
  pageContext,
}: {
  children: React.ReactNode
  pageContext: CrmPageContext
}) {
  const locale = (useLocale() as Locale) || 'en'
  const pathname = usePathname() || ''
  const tAdmin = useTranslations('modules.admin')
  const labels = buildModulesAdminLabels((key, ...args) => tAdmin(key as never, ...(args as never[])))

  return (
    <AdminWrapper
      locale={locale}
      pageContext={pageContext}
      labels={labels}
      showRightRail={false}
    >
      <div className="space-y-4 px-4 py-6 lg:px-6">
        <nav
          aria-label="CRM sections"
          className="flex gap-1 overflow-x-auto border-b pb-2"
        >
          {CRM_TABS.map((tab) => {
            const href = tab.href(locale)
            const pathSuffix = tab.id.replace(/^crm-/, '')
            const active =
              pageContext === tab.id ||
              pathname.includes(`/admin/crm/${pathSuffix}`)
            return (
              <Link
                key={tab.id}
                className={cn(
                  'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                href={href}
              >
                {tAdmin(tab.labelKey as never)}
              </Link>
            )
          })}
        </nav>
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </div>
    </AdminWrapper>
  )
}

/** @deprecated use CrmAdminShell */
export const EmailAdminShell = CrmAdminShell
