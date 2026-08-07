'use client'

/**
 * MEMBERSHIP WRAPPER - Ring Platform v2.0
 * ========================================
 * Consolidated to RingRightRailLayout + MembershipRail.
 */

import React from 'react'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { MembershipRail } from '@/components/layout/rails/membership-rail'

interface MembershipWrapperProps {
  children: React.ReactNode
  locale: string
}

export default function MembershipWrapper({ children, locale }: MembershipWrapperProps) {
  return (
    <RingRightRailLayout
      rightRailPurpose="membership"
      rightRailContent={[
        { blockType: 'membership-benefits', i18nKey: 'modules.membership.sidebar.member_benefits' },
        { blockType: 'membership-pricing' },
        { blockType: 'membership-payment-options' },
        { blockType: 'membership-help' },
      ]}
      rightRail={<MembershipRail locale={locale} />}
      railWidth={300}
      contentClassName="pb-24 lg:pb-8"
      flushCenterPane
    >
      <DavinciCenterPane>
        {children}
      </DavinciCenterPane>
    </RingRightRailLayout>
  )
}
