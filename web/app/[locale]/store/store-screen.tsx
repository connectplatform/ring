'use client'

import type { Locale } from '@/i18n/shared'
import StoreWrapper from '@/components/wrappers/store-wrapper'
import StorePageClient from './store-page-client'

/**
 * One client reference for the store route.
 * AppClientShell imports this module so Turbopack evaluates StoreWrapper and
 * StorePageClient with the layout graph, before the first soft navigation
 * to /store asks the flight for their default exports.
 */
export default function StoreScreen({ locale }: { locale: Locale }) {
  return (
    <StoreWrapper key={locale} locale={locale}>
      <StorePageClient locale={locale} />
    </StoreWrapper>
  )
}
