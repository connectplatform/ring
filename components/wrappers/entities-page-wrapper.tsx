'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/shared'
import { useSession } from 'next-auth/react'
import { ROUTES } from '@/constants/routes'
import { Plus, Search, User } from 'lucide-react'
import ModuleSectionNav from '@/components/navigation/module-section-nav'

interface EntitiesPageWrapperProps {
  children: React.ReactNode
  locale: Locale
}

/**
 * Entities layout shell — top section nav only (store SSOT: filter rail lives in list wrapper).
 */
export default function EntitiesPageWrapper({ children, locale }: EntitiesPageWrapperProps) {
  const { data: session } = useSession()
  const t = useTranslations('modules.entities')

  const navItems = session?.user
    ? [
        {
          id: 'browse',
          label: t('viewAll', { defaultValue: 'View All' }),
          href: ROUTES.ENTITIES(locale),
          icon: Search,
          match: 'exact' as const,
        },
        {
          id: 'my',
          label: t('myEntities'),
          href: ROUTES.MY_ENTITIES(locale),
          icon: User,
          match: 'exact' as const,
        },
        {
          id: 'create',
          label: t('addMyEntity'),
          href: ROUTES.ADD_ENTITY(locale),
          icon: Plus,
          variant: 'outline' as const,
          match: 'prefix' as const,
        },
      ]
    : []

  return (
    <div className="min-h-full">
      {session?.user && (
        <ModuleSectionNav
          title={t('title', { defaultValue: 'Entities' })}
          items={navItems}
          className="mb-4"
        />
      )}
      {children}
    </div>
  )
}
