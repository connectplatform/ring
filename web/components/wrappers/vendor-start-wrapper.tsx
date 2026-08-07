'use client'

/**
 * VENDOR START WRAPPER - Ring Platform v2.0
 * ===========================================
 * Consolidated to RingRightRailLayout + VendorStartRail.
 */

import React from 'react'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { VendorStartRail } from '@/components/layout/rails/vendor-start-rail'

interface VendorStartWrapperProps {
  children: React.ReactNode
  locale: string
  progressPercent?: number
}

export default function VendorStartWrapper({
  children,
  locale,
  progressPercent = 75,
}: VendorStartWrapperProps) {
  return (
    <RingRightRailLayout
      rightRailPurpose="vendor-start"
      rightRailContent={[
        { blockType: 'vendor-setup-progress', i18nKey: 'vendor.startWrapper.setupProgress' },
        { blockType: 'vendor-platform-benefits' },
        { blockType: 'vendor-next-steps' },
        { blockType: 'vendor-guide' },
      ]}
      rightRail={<VendorStartRail locale={locale} progressPercent={progressPercent} />}
      railWidth={300}
      contentClassName="pb-24 lg:pb-8"
      flushCenterPane
    >
      <DavinciCenterPane contentClassName="!p-0">
        {children}
      </DavinciCenterPane>
    </RingRightRailLayout>
  )
}
