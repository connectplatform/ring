'use client'

import { Suspense, useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { useSession } from "next-auth/react"
import { useSearchParams, usePathname } from "next/navigation"
import { useTranslations } from 'next-intl'
import type { SerializedEntity } from "@/features/entities/types"
import { deserializeEntities } from "@/lib/converters/entity-serializer"
import { EntitySuspenseBoundary } from "@/components/suspense/enhanced-suspense-boundary"
import { Button } from '@/components/ui/button'
import { Building2, User, Plus } from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import { AddEntityButton } from '@/components/entities/add-entity-button'
import Link from 'next/link'

/**
 * Dynamically import the EntitiesContent component
 * This allows for code splitting and improved performance
 */
const EntitiesContent = dynamic(() => import("@/features/entities/components/entities"), {
  ssr: false
})

/**
 * EntitiesWrapper component props
 */
interface EntitiesWrapperProps {
  initialEntities: SerializedEntity[]
  initialError: string | null
  page: number
  totalPages: number
  totalEntities: number
  lastVisible: string | null
  initialLimit: number
  initialSort: string
  initialFilter: string
}

/**
 * EntitiesWrapper component
 * Wraps the EntitiesContent component and handles client-side state
 *
 * User steps:
 * 1. User visits the entities page
 * 2. Component initializes with server-side props
 * 3. Component updates state based on URL search params
 * 4. User can interact with the entities list (view, sort, filter, paginate)
 *
 * @param {EntitiesWrapperProps} props - The props for the EntitiesWrapper component
 * @returns {JSX.Element} The rendered EntitiesWrapper component
 */
export default function EntitiesWrapper({
  initialEntities,
  initialError,
  page,
  totalPages,
  totalEntities,
  lastVisible,
  initialLimit,
  initialSort,
  initialFilter,
}: EntitiesWrapperProps) {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const t = useTranslations('modules.entities')
  const [mounted, setMounted] = useState(false)
  const [entities, setEntities] = useState<SerializedEntity[]>(initialEntities)
  const [error, setError] = useState<string | null>(initialError)
  const [limit, setLimit] = useState(initialLimit)
  const [sort, setSort] = useState(initialSort)
  const [filter, setFilter] = useState(initialFilter)
  
  const locale = pathname.split('/')[1] || 'en'

  // Prevent hydration mismatches
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    
    // Update state based on URL search params
    const limitParam = searchParams.get("limit")
    const sortParam = searchParams.get("sort")
    const filterParam = searchParams.get("filter")

    if (limitParam) setLimit(Number.parseInt(limitParam, 10))
    if (sortParam) setSort(sortParam)
    if (filterParam) setFilter(filterParam)
  }, [searchParams, mounted])

  // Show loading state until mounted to prevent hydration mismatches
  if (!mounted) {
    return (
      <EntitySuspenseBoundary 
        level="page" 
        showProgress={true}
        description="Preparing entities directory for display"
        retryEnabled={false}
      >
        <div />
      </EntitySuspenseBoundary>
    )
  }

  return (
    <div>
      {/* Main Navigation Bar for Entities */}
      <div className="bg-white border-b mb-6">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">
              {t('title', { defaultValue: 'Entities' })}
            </h1>
            
            <div className="flex flex-wrap gap-3">
              {session?.user && (
                <>
                  {/* Add Entity Button */}
                  <AddEntityButton locale={locale as any} className="flex items-center gap-2" />
                </>
              )}
              <Link href={ROUTES.ENTITIES(locale as any)}>
                <Button variant="ghost" className="flex items-center gap-2">
                  <Building2 size={20} />
                  {t('viewAll', { defaultValue: 'View All' })}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <EntitySuspenseBoundary 
        level="page" 
        showProgress={true}
        description="Loading entities directory with advanced filtering and sorting"
        retryEnabled={true}
        onRetry={() => window.location.reload()}
      >
        <EntitiesContent
          initialEntities={entities}
          initialError={error}
          page={page}
          totalPages={totalPages}
          totalEntities={totalEntities}
          lastVisible={lastVisible}
          limit={limit}
          sort={sort}
          filter={filter}
        />
      </EntitySuspenseBoundary>
    </div>
  )
}

