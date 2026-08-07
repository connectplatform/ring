'use client'

/**
 * USER PROFILE WRAPPER - Ring Platform v2.0
 * ==========================================
 * Consolidated to RingRightRailLayout + UserProfileRail.
 */

import React from 'react'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { UserProfileRail } from '@/components/layout/rails/user-profile-rail'

interface UserProfileWrapperProps {
  children: React.ReactNode
  locale: string
  username: string
}

export default function UserProfileWrapper({ children, locale, username }: UserProfileWrapperProps) {
  return (
    <RingRightRailLayout
      rightRailPurpose="user-profile"
      rightRailContent={[
        { blockType: 'profile-activity', i18nKey: 'profile.activity' },
        { blockType: 'profile-share' },
        { blockType: 'profile-achievements' },
        { blockType: 'profile-guide' },
      ]}
      rightRail={<UserProfileRail locale={locale} username={username} />}
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
