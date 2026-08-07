'use client'

/**
 * NEWS PAGE WRAPPER - Ring Platform v2.0
 * ========================================
 * Consolidated to RingRightRailLayout + NewsPageRail.
 *
 * Note: locale remains `string` for compatibility with 3+ consuming pages
 * that pass the locale as a route param string.
 */

import React from 'react'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { NewsPageRail } from '@/components/layout/rails/news-page-rail'

interface NewsPageWrapperProps {
  children: React.ReactNode
  locale: string
  categoryInfo: Record<string, { name: string; description?: string; color?: string; icon?: string; articleCount: number }>
  translations?: Record<string, any>
}

export default function NewsPageWrapper({
  children,
  locale,
  categoryInfo,
  translations = {},
}: NewsPageWrapperProps) {
  return (
    <RingRightRailLayout
      rightRailPurpose="news"
      rightRailContent={[
        { blockType: 'news-trending', i18nKey: 'news.trending' },
        { blockType: 'news-newsletter' },
        { blockType: 'news-rss' },
        { blockType: 'news-events' },
        { blockType: 'news-resources' },
      ]}
      rightRail={
        <NewsPageRail
          locale={locale}
          categoryInfo={categoryInfo}
          translations={translations}
        />
      }
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
