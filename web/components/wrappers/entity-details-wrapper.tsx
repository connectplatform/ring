'use client'

import React, { Suspense, useCallback, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import EntityDetails from '@/features/entities/components/entity-details'
import { SerializedEntity } from '@/features/entities/types'
import { EntityConversationPanel } from '@/features/chat/components/entity-conversation-panel'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import EntitiesBrowseRail from '@/components/entities/entities-browse-rail'
import type { Locale } from '@/i18n/shared'

interface EntityDetailsWrapperProps {
  initialEntity: SerializedEntity | null
  initialError: string | null
  params: { id: string }
  searchParams: Record<string, string | string[] | undefined>
  locale: Locale
}

export default function EntityDetailsWrapper({
  initialEntity,
  initialError,
  locale,
}: EntityDetailsWrapperProps) {
  const { data: session, status } = useSession()
  const t = useTranslations('modules.entities.wrapper')
  const tCommon = useTranslations('common')
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
  const closeRail = useCallback(() => setRightSidebarOpen(false), [])
  const rightRail = useMemo(
    () => <EntitiesBrowseRail locale={locale} onNavigate={closeRail} />,
    [locale, closeRail],
  )

  if (status === 'loading') {
    return <div>{tCommon('loading')}</div>
  }

  if (!session) {
    return <div>{t('loginRequired')}</div>
  }

  const chatComponent = initialEntity ? (
    <EntityConversationPanel
      entityId={initialEntity.id}
      entityName={initialEntity.name}
      entityCreatorId={initialEntity.addedBy}
      className="border-0 shadow-none"
    />
  ) : null

  return (
    <RingRightRailLayout
      showRightRail
      flushCenterPane
      isOpen={rightSidebarOpen}
      onToggle={setRightSidebarOpen}
      rightRail={rightRail}
    >
      <DavinciCenterPane>
        <Suspense fallback={<div>{tCommon('loading')}</div>}>
          <EntityDetails
            initialEntity={initialEntity}
            initialError={initialError}
            chatComponent={chatComponent}
            locale={locale}
          />
        </Suspense>
      </DavinciCenterPane>
    </RingRightRailLayout>
  )
}
