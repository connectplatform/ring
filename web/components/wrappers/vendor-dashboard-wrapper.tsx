'use client'

/**
 * VENDOR DASHBOARD WRAPPER - Ring Platform v2.0
 * ==============================================
 * Consolidated to RingRightRailLayout + VendorDashboardRail.
 *
 * Note: locale remains `string` for compatibility with 5+ consuming pages
 * that pass the locale as a route param string.
 */

import React from 'react'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { VendorDashboardRail } from '@/components/layout/rails/vendor-dashboard-rail'

interface VendorDashboardWrapperProps {
  children: React.ReactNode
  locale: string
}

export default function VendorDashboardWrapper({
  children,
  locale,
}: VendorDashboardWrapperProps) {
  return (
    <RingRightRailLayout
      rightRailPurpose="vendor-dashboard"
      rightRailContent={[
        { blockType: 'vendor-quick-actions', i18nKey: 'vendor.dashboard.quickActionsTitle' },
        { blockType: 'vendor-boost-sales', i18nKey: 'vendor.dashboard.boostSalesTitle' },
        { blockType: 'vendor-resources', i18nKey: 'vendor.dashboard.resourcesTitle' },
      ]}
      rightRail={<VendorDashboardRail locale={locale} />}
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
