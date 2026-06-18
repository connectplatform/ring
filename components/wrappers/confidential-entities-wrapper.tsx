'use client'

import React, { Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { Entity } from '@/types'
import { ConfidentialEntitiesProvider } from '@/features/entities/context/confidential-entities-context'
import { hasConfidentialAccess } from '@/features/auth/user-role'

const ConfidentialEntities = React.lazy(
  () => import('@/features/entities/components/confidential-entities')
)

interface ConfidentialEntitiesWrapperProps {
  initialEntities: Entity[]
  initialError: string | null
  initialPage: number
  page: number
  totalPages: number
  totalEntities: number
  lastVisible: string | null
  initialLimit: number
  initialSort: string
  initialFilter: string
}

function LoadingFallback({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse">{message}</div>
    </div>
  )
}

function canAccessConfidential(role: string | undefined | null): boolean {
  return hasConfidentialAccess(role)
}

export default function ConfidentialEntitiesWrapper({
  initialEntities,
  initialError,
  initialPage,
  page,
  totalPages,
  totalEntities,
  lastVisible,
  initialLimit,
  initialSort,
  initialFilter,
}: ConfidentialEntitiesWrapperProps) {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const t = useTranslations('confidential.entities.wrapper')
  const [mounted, setMounted] = React.useState(false)

  const currentPage = parseInt(searchParams.get('page') || initialPage.toString(), 10)
  const limit = parseInt(searchParams.get('limit') || initialLimit.toString(), 10)
  const currentSort = searchParams.get('sort') || initialSort
  const currentFilter = searchParams.get('filter') || initialFilter

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || status === 'loading') {
    return <LoadingFallback message={t('loading')} />
  }

  if (!session?.user || !canAccessConfidential(session.user.role)) {
    return (
      <div className="text-center p-4 text-destructive">
        {t('permissionDenied')}
      </div>
    )
  }

  return (
    <div className="ring-content-panel min-w-0 min-h-full">
      <ConfidentialEntitiesProvider initialEntities={initialEntities} initialError={initialError}>
        <Suspense fallback={<LoadingFallback message={t('loading')} />}>
          <ConfidentialEntities
            initialEntities={initialEntities}
            initialError={initialError}
            page={currentPage}
            totalPages={totalPages}
            totalEntities={totalEntities}
            lastVisible={lastVisible}
            limit={limit}
            sort={currentSort}
            filter={currentFilter}
          />
        </Suspense>
      </ConfidentialEntitiesProvider>
    </div>
  )
}
