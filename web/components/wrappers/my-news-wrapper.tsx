'use client'

/**
 * MY NEWS WRAPPER — same RingRightRailLayout + DavinciCenterPane pattern as admin/dao.
 * Title lives in the right rail; center pane holds charts + article management.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import { MyNewsRail, type MyNewsRailStats } from '@/components/layout/rails/my-news-rail'
import type { Locale } from '@/i18n/shared'

interface MyNewsWrapperProps {
  children: React.ReactNode
  locale: Locale
  title: string
  description: string
  userName: string
  blogUsername?: string | null
  siteBaseUrl?: string
  stats?: MyNewsRailStats | null
}

export default function MyNewsWrapper({
  children,
  locale,
  title,
  description,
  userName,
  blogUsername = null,
  siteBaseUrl = '',
  stats = null,
}: MyNewsWrapperProps) {
  const [mounted, setMounted] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const closeRail = useCallback(() => setRightSidebarOpen(false), [])

  const rightRail = useMemo(
    () => (
      <MyNewsRail
        locale={locale}
        title={title}
        description={description}
        userName={userName}
        blogUsername={blogUsername}
        siteBaseUrl={siteBaseUrl}
        stats={stats}
        onNavigate={closeRail}
      />
    ),
    [locale, title, description, userName, blogUsername, siteBaseUrl, stats, closeRail],
  )

  if (!mounted) {
    return <div className="min-h-[40vh]">{children}</div>
  }

  return (
    <RingRightRailLayout
      rightRail={rightRail}
      rightRailPurpose="generic"
      flushCenterPane
      contentClassName="pb-24 lg:pb-8"
      isOpen={rightSidebarOpen}
      onToggle={setRightSidebarOpen}
    >
      <DavinciCenterPane contentClassName="space-y-6">{children}</DavinciCenterPane>
    </RingRightRailLayout>
  )
}
