// React 19 + Next.js 15: Server component wrapper
import { OpportunityTypeSelectorClient } from './opportunity-type-selector-client'
import type { Locale } from '@/i18n/shared'

interface OpportunityTypeSelectorProps {
  onClose?: () => void
  userRole: 'member' | 'subscriber'
  locale?: Locale
  layout?: 'embedded' | 'overlay'
}

export function OpportunityTypeSelector(props: OpportunityTypeSelectorProps) {
  return <OpportunityTypeSelectorClient {...props} />
}
