'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/constants/routes'
import { isPlatformAdmin } from '@/features/auth/user-role'
import type { Locale } from '@/i18n/shared'

export type StoreHubTab =
  | 'hub'
  | 'products'
  | 'orders'
  | 'stock'
  | 'warehouses'
  | 'commissions'
  | 'settings'
  | 'promotions'

interface StoreHubTabsProps {
  locale: Locale
  active: StoreHubTab
}

export default function StoreHubTabs({ locale, active }: StoreHubTabsProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const isAdmin = !session?.user || isPlatformAdmin(session.user.role)
  const platformAdmin = Boolean(session?.user && isPlatformAdmin(session.user.role))
  const t = useTranslations('modules.admin.storeHub')

  const tabs: { id: StoreHubTab; href: string; label: string }[] = [
    {
      id: 'hub',
      href: isAdmin ? ROUTES.ADMIN_STORE(locale) : ROUTES.VENDOR_DASHBOARD(locale),
      label: t('hub'),
    },
    {
      id: 'products',
      href: isAdmin ? ROUTES.ADMIN_STORE_PRODUCTS(locale) : ROUTES.VENDOR_PRODUCTS(locale),
      label: t('products'),
    },
    {
      id: 'orders',
      href: isAdmin ? ROUTES.ADMIN_STORE_ORDERS(locale) : ROUTES.VENDOR_ORDERS(locale),
      label: t('orders'),
    },
    {
      id: 'stock',
      href: isAdmin ? ROUTES.ADMIN_STORE_STOCK(locale) : ROUTES.VENDOR_STOCK(locale),
      label: t('stock'),
    },
    ...(platformAdmin
      ? [
          {
            id: 'warehouses' as const,
            href: ROUTES.ADMIN_STORE_WAREHOUSES(locale),
            label: t('warehouses'),
          },
        ]
      : []),
    {
      id: 'commissions',
      href: isAdmin ? ROUTES.ADMIN_STORE_COMMISSIONS(locale) : ROUTES.VENDOR_EARNINGS(locale),
      label: t('commissions'),
    },
    { id: 'settings', href: ROUTES.ADMIN_STORE_SETTINGS(locale), label: t('settings') },
    { id: 'promotions', href: ROUTES.ADMIN_STORE_PROMOTIONS(locale), label: t('promotions') },
  ]

  return (
    <nav className="flex gap-1 border-b border-border mb-6 overflow-x-auto" aria-label="Store admin sections">
      {tabs.map((tab) => {
        const isActive = tab.id === active || pathname === tab.href || pathname?.endsWith(tab.href)
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
              isActive
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
