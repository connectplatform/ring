// React 19 + Next.js 15: Server component wrapper
// Delegates to client component for interactivity
import { OpportunityTypeSelectorClient } from './opportunity-type-selector-client'
import type { Locale } from '@/i18n-config'

interface OpportunityTypeSelectorProps {
  onClose: () => void
  userRole: 'member' | 'subscriber'
  locale: Locale
}

// Server component - lightweight wrapper that passes props to client component
// This pattern follows React 19 best practices: server components by default,
// only mark interactive parts with 'use client'
export function OpportunityTypeSelector(props: OpportunityTypeSelectorProps) {
  return <OpportunityTypeSelectorClient {...props} />
}
