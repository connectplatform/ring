'use client'

/**
 * Store Floating Buttons
 * 
 * RESPONSIVE LAYOUT:
 * - Mobile/iPad: All three buttons grouped (bottom-24 right-6, above nav menu)
 * - Desktop: Split into two groups:
 *   • Sort: Bottom-right of feed (fixed bottom-6 right-[352px])
 *   • Cart + Checkout: Top-right of sidebar (fixed top-6 right-6)
 */

import Link from 'next/link'
import { ShoppingCart, CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/constants/routes'
import { useOptionalStore } from '@/features/store/context'
import { useTranslations } from 'next-intl'
import type { Locale } from '@/i18n-config'
import FloatingSortButton from '@/components/common/floating-sort-button'

interface FloatingButtonsProps {
  locale: Locale
  currentSort?: string
  onSortChange?: (sortBy: string) => void
}

export default function FloatingButtons({ 
  locale,
  currentSort = 'name-asc',
  onSortChange 
}: FloatingButtonsProps) {
  const store = useOptionalStore()
  const totalItems = store?.totalItems || 0
  const t = useTranslations('modules.store')

  return (
    <>
      {/* MOBILE (< 768px): All three buttons grouped, higher than nav menu */}
      <div className="fixed bottom-24 right-6 flex gap-3 z-50 md:hidden">
        {totalItems > 0 && (
          <>
            <Link
              href={ROUTES.CART(locale)}
              className={cn(
                "h-14 w-14 p-0 rounded-full shadow-lg hover:shadow-xl transition-all",
                "bg-primary hover:bg-primary/90",
                "flex items-center justify-center"
              )}
              aria-label={t('cart.title')}
              title={t('cart.title')}
            >
              <div className="relative">
                <ShoppingCart className="h-6 w-6 text-primary-foreground" />
                <span className="absolute -top-2 -right-2 inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                  {totalItems}
                </span>
              </div>
            </Link>

            <Link
              href={ROUTES.CHECKOUT(locale)}
              className={cn(
                "h-14 w-14 p-0 rounded-full shadow-lg hover:shadow-xl transition-all",
                "bg-secondary hover:bg-secondary/90",
                "flex items-center justify-center"
              )}
              aria-label={t('checkout.title')}
              title={t('checkout.title')}
            >
              <CreditCard className="h-6 w-6 text-secondary-foreground" />
            </Link>
          </>
        )}

        <FloatingSortButton currentSort={currentSort} onSortChange={onSortChange} title="Sort Products By" />
      </div>

      {/* IPAD (768px - 1023px): All three buttons grouped */}
      <div className="hidden md:flex lg:hidden fixed bottom-6 right-6 gap-3 z-50">
        {totalItems > 0 && (
          <>
            <Link
              href={ROUTES.CART(locale)}
              className={cn(
                "h-14 w-14 p-0 rounded-full shadow-lg hover:shadow-xl transition-all",
                "bg-primary hover:bg-primary/90",
                "flex items-center justify-center"
              )}
              aria-label={t('cart.title')}
              title={t('cart.title')}
            >
              <div className="relative">
                <ShoppingCart className="h-6 w-6 text-primary-foreground" />
                <span className="absolute -top-2 -right-2 inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                  {totalItems}
                </span>
              </div>
            </Link>

            <Link
              href={ROUTES.CHECKOUT(locale)}
              className={cn(
                "h-14 w-14 p-0 rounded-full shadow-lg hover:shadow-xl transition-all",
                "bg-secondary hover:bg-secondary/90",
                "flex items-center justify-center"
              )}
              aria-label={t('checkout.title')}
              title={t('checkout.title')}
            >
              <CreditCard className="h-6 w-6 text-secondary-foreground" />
            </Link>
          </>
        )}

        <FloatingSortButton currentSort={currentSort} onSortChange={onSortChange} title="Sort Products By" />
      </div>

      {/* DESKTOP (>= 1024px): Sort at bottom-right of feed */}
      <div className="hidden lg:block fixed bottom-6 right-[352px] z-40">
        <FloatingSortButton currentSort={currentSort} onSortChange={onSortChange} title="Sort Products By" />
      </div>

      {/* DESKTOP (>= 1024px): Cart + Checkout at bottom-24 right-6 (when cart has items) */}
      {totalItems > 0 && (
        <div className="hidden lg:flex fixed bottom-24 right-6 gap-3 z-40">
          <Link
            href={ROUTES.CART(locale)}
            className={cn(
              "h-14 w-14 p-0 rounded-full shadow-lg hover:shadow-xl transition-all",
              "bg-primary hover:bg-primary/90",
              "flex items-center justify-center"
            )}
            aria-label={t('cart.title')}
            title={t('cart.title')}
          >
            <div className="relative">
              <ShoppingCart className="h-6 w-6 text-primary-foreground" />
              <span className="absolute -top-2 -right-2 inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                {totalItems}
              </span>
            </div>
          </Link>

          <Link
            href={ROUTES.CHECKOUT(locale)}
            className={cn(
              "h-14 w-14 p-0 rounded-full shadow-lg hover:shadow-xl transition-all",
              "bg-secondary hover:bg-secondary/90",
              "flex items-center justify-center"
            )}
            aria-label={t('checkout.title')}
            title={t('checkout.title')}
          >
            <CreditCard className="h-6 w-6 text-secondary-foreground" />
          </Link>
        </div>
      )}
    </>
  )
}

