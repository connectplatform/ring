'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'

export type StoreHubTab = 'hub' | 'products' | 'orders' | 'stock' | 'commissions'

interface StoreHubTabsProps {
  locale: Locale
  active: StoreHubTab
}

export default function StoreHubTabs({ locale, active }: StoreHubTabsProps) {
  const pathname = usePathname()
  const t = useTranslations('modules.admin.storeHub')

  const tabs: { id: StoreHubTab; href: string; label: string }[] = [
    { id: 'hub', href: ROUTES.ADMIN_STORE(locale), label: t('hub') },
    { id: 'products', href: ROUTES.ADMIN_STORE_PRODUCTS(locale), label: t('products') },
    { id: 'orders', href: ROUTES.ADMIN_STORE_ORDERS(locale), label: t('orders') },
    { id: 'stock', href: ROUTES.ADMIN_STORE_STOCK(locale), label: t('stock') },
    { id: 'commissions', href: ROUTES.ADMIN_STORE_COMMISSIONS(locale), label: t('commissions') },
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
