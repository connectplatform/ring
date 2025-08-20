'use client'

import React, { Suspense } from 'react'
import { useSession } from '@/components/providers/session-provider'
import { useTranslations } from 'next-intl'
import EntityDetails from '@/features/entities/components/entity-details'
import { SerializedEntity } from '@/features/entities/types'
import Chat from '@/features/chat/components/chat'

interface EntityDetailsWrapperProps {
  initialEntity: SerializedEntity | null
  initialError: string | null
  params: { id: string }
  searchParams: Record<string, string | string[] | undefined>
}

export default function EntityDetailsWrapper({
  initialEntity,
  initialError,
  params,
  searchParams
}: EntityDetailsWrapperProps) {
  const { data: session, status } = useSession()
  const t = useTranslations('common')

  if (status === 'loading') {
    return <div>{t('loading')}</div>
  }

  if (!session) {
    return <div>Please log in to view this page.</div>
  }

  const chatComponent = initialEntity ? (
    <Chat 
      entityId={initialEntity.id} 
      entityName={initialEntity.name} 
      entityCreatorId={initialEntity.addedBy} 
    />
  ) : null;

  return (
    <Suspense fallback={<div>{t('loading')}</div>}>
      <EntityDetails 
        initialEntity={initialEntity} 
        initialError={initialError} 
        chatComponent={chatComponent}
      />
    </Suspense>
  )
}

