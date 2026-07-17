'use client'

/**
 * CHANGELOG WRAPPER — center article + right rail (publisher/project + CTAs)
 */

import React, { useCallback, useMemo, useState } from 'react'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import { ChangelogRail } from '@/components/layout/rails/changelog-rail'
import type { Locale } from '@/i18n/shared'

export interface ChangelogWrapperProps {
  children: React.ReactNode
  locale: Locale
  publisherName: string
  projectName: string
  projectDescription: string
  version: string
  organization?: string
  contactEmail?: string
}

export default function ChangelogWrapper({
  children,
  locale,
  publisherName,
  projectName,
  projectDescription,
  version,
  organization,
  contactEmail,
}: ChangelogWrapperProps) {
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
  const closeRail = useCallback(() => setRightSidebarOpen(false), [])

  const rightRail = useMemo(
    () => (
      <ChangelogRail
        locale={locale}
        publisherName={publisherName}
        projectName={projectName}
        projectDescription={projectDescription}
        version={version}
        organization={organization}
        contactEmail={contactEmail}
        onNavigate={closeRail}
      />
    ),
    [
      locale,
      publisherName,
      projectName,
      projectDescription,
      version,
      organization,
      contactEmail,
      closeRail,
    ],
  )

  return (
    <RingRightRailLayout
      rightRailPurpose="generic"
      rightRailContent={[
        { blockType: 'changelog-project' },
        { blockType: 'changelog-publisher' },
        { blockType: 'changelog-actions' },
      ]}
      rightRail={rightRail}
      flushCenterPane
      contentClassName="pb-24 lg:pb-8"
      railWidth={300}
      isOpen={rightSidebarOpen}
      onToggle={setRightSidebarOpen}
    >
      <DavinciCenterPane>{children}</DavinciCenterPane>
    </RingRightRailLayout>
  )
}
