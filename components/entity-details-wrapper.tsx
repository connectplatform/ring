'use client'

import React, { Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslation } from '@/node_modules/react-i18next'
import EntityDetails from '@/features/entities/components/entity-details'
import { Entity } from '@/features/entities/types'
import { Chat } from '@/features/chat/components/chat'

interface EntityDetailsWrapperProps {
  initialEntity: Entity | null
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
  const { t } = useTranslation()

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

