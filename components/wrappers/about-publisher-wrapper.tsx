'use client'

/**
 * ABOUT PUBLISHER WRAPPER - Ring Platform v2.0
 * ==============================================
 * Consolidated to RingRightRailLayout + AboutPublisherRail.
 */

import React from 'react'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { AboutPublisherRail } from '@/components/layout/rails/about-publisher-rail'

interface AboutPublisherWrapperProps {
  children: React.ReactNode
  locale: string
}

export default function AboutPublisherWrapper({ children, locale }: AboutPublisherWrapperProps) {
  return (
    <RingRightRailLayout
      rightRailPurpose="about-publisher"
      rightRailContent={[
        { blockType: 'publisher-intro', i18nKey: 'about-publisher.sidebar.publisher_title' },
        { blockType: 'publisher-get-started' },
        { blockType: 'publisher-docs' },
        { blockType: 'publisher-impact' },
      ]}
      rightRail={<AboutPublisherRail locale={locale} />}
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
