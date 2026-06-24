'use client'

/**
 * Opportunity form layout — center content + DaVinci guidance rail (add/edit).
 * Locale keys: locales/{locale}/modules/opportunities.json (formRail, type_selector).
 */

import React, { useState } from 'react'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import OpportunityFormGuidanceRail, {
  type OpportunityFormRailType,
} from '@/components/opportunities/opportunity-form-guidance-rail'
import type { Locale } from '@/i18n/shared'

interface OpportunityFormWrapperProps {
  children: React.ReactNode
  locale: string
  opportunityType?: OpportunityFormRailType
}

export default function OpportunityFormWrapper({
  children,
  locale,
  opportunityType,
}: OpportunityFormWrapperProps) {
  const resolvedLocale = locale as Locale
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  return (
    <RingRightRailLayout
      flushCenterPane
      isOpen={rightSidebarOpen}
      onToggle={setRightSidebarOpen}
      rightRail={
        <OpportunityFormGuidanceRail
          locale={resolvedLocale}
          opportunityType={opportunityType}
          onNavigate={() => setRightSidebarOpen(false)}
        />
      }
    >
      {children}
    </RingRightRailLayout>
  )
}
