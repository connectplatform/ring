'use client'

/**
 * Thin client re-export so callers can import a stable name.
 * Prefer OpportunityTypeSelectorClient for new call sites.
 */
import { OpportunityTypeSelectorClient } from './opportunity-type-selector-client'
import type { Locale } from '@/i18n/shared'
import type { OpportunityTypeSelectorLayout } from './opportunity-type-selector-client'
import { UserRolesArray } from '@/features/auth/user-role'

interface OpportunityTypeSelectorProps {
  onClose?: () => void
  userRole: UserRolesArray | 'member' | 'subscriber'
  locale?: Locale
  layout?: OpportunityTypeSelectorLayout
}

export function OpportunityTypeSelector(props: OpportunityTypeSelectorProps) {
  return (
    <OpportunityTypeSelectorClient
      userRole={props.userRole as 'member' | 'subscriber'}
      locale={props.locale}
      layout={props.layout}
      onClose={props.onClose}
    />
  )
}
