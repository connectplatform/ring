'use client'

import { OpportunityTypeSelectorClient } from '@/components/opportunities/opportunity-type-selector-client'
import type { Locale } from '@/i18n/shared'

interface OpportunityTypePickerPaneProps {
  userRole: 'member' | 'subscriber'
  locale: Locale
}

/** Center-pane type selection before the opportunity form (desktop + mobile). */
export function OpportunityTypePickerPane({ userRole, locale }: OpportunityTypePickerPaneProps) {
  return (
    <OpportunityTypeSelectorClient
      layout="embedded"
      userRole={userRole}
      locale={locale}
    />
  )
}
