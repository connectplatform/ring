'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'

export type StoreHubTab = 'orders' | 'stock' | 'commissions'

interface StoreHubTabsProps {
  locale: Locale
  active: StoreHubTab
  labels: {
    orders: string
    stock: string
    commissions: string
  }
}

export default function StoreHubTabs({ locale, active, labels }: StoreHubTabsProps) {
  const pathname = usePathname()

  const tabs: { id: StoreHubTab; href: string; label: string }[] = [
    { id: 'orders', href: ROUTES.ADMIN_STORE_ORDERS(locale), label: labels.orders },
    { id: 'stock', href: ROUTES.ADMIN_STORE_STOCK(locale), label: labels.stock },
    { id: 'commissions', href: ROUTES.ADMIN_STORE_COMMISSIONS(locale), label: labels.commissions },
  ]

  return (
    <nav className="flex gap-1 border-b border-border mb-6" aria-label="Store admin sections">
      {tabs.map((tab) => {
        const isActive = tab.id === active || pathname === tab.href || pathname?.endsWith(tab.href)
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
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
