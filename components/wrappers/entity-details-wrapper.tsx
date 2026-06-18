'use client'

import React, { Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import EntityDetails from '@/features/entities/components/entity-details'
import { SerializedEntity } from '@/features/entities/types'
import { EntityConversationPanel } from '@/features/chat/components/entity-conversation-panel'
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
  params,
  searchParams,
  locale,
}: EntityDetailsWrapperProps) {
  const { data: session, status } = useSession()
  const t = useTranslations('modules.entities.wrapper')
  const tCommon = useTranslations('common')

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
  ) : null;

  return (
    <div className="ring-content-panel min-w-0 min-h-full">
    <Suspense fallback={<div>{tCommon('loading')}</div>}>
      <EntityDetails 
        initialEntity={initialEntity} 
        initialError={initialError} 
        chatComponent={chatComponent}
        locale={locale}
      />
    </Suspense>
    </div>
  )
}

