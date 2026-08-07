'use client'

/**
 * VENDOR PRODUCTS WRAPPER - Ring Platform v2.0
 * ==============================================
 * Consolidated to RingRightRailLayout + VendorProductsRail.
 */

import React from 'react'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { VendorProductsRail } from '@/components/layout/rails/vendor-products-rail'

interface VendorProductsWrapperProps {
  children: React.ReactNode
  locale: string
}

export default function VendorProductsWrapper({ children, locale }: VendorProductsWrapperProps) {
  return (
    <RingRightRailLayout
      rightRailPurpose="vendor-products"
      rightRailContent={[
        { blockType: 'vendor-quick-actions', i18nKey: 'vendor.products.quickActions' },
        { blockType: 'vendor-product-tips' },
        { blockType: 'vendor-product-guide' },
      ]}
      rightRail={<VendorProductsRail locale={locale} />}
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
