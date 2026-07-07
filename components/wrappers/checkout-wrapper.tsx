'use client'

/**
 * CHECKOUT PAGE WRAPPER - Ring Platform v2.0
 *
 * Thin wrapper using RingRightRailLayout + DavinciCenterPane (flush).
 *
 * Special case: showRightRail={false} because the checkout content (PrebillingPage etc.)
 * owns its own order summary / payment UI.
 *
 * Mobile floating sidebar + extracted checkout-rail can be wired later if needed.
 */

import React from 'react'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import type { Locale } from '@/i18n/shared'

interface CheckoutWrapperProps {
  children: React.ReactNode
  locale: Locale
}

export default function CheckoutWrapper({ children }: CheckoutWrapperProps) {
  // Modernized: desktop rail suppressed; children (checkout flow) render in center pane.
  return (
    <RingRightRailLayout
      rightRailPurpose="cart"
      showRightRail={false}
      contentClassName="pb-24 lg:pb-8"
      flushCenterPane
    >
      <DavinciCenterPane>
        {children}
      </DavinciCenterPane>
    </RingRightRailLayout>
  )
}
