'use client'

import { Suspense, useState, useEffect, useTransition, useCallback } from "react"
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
 * GreenFood Agricultural EntitiesWrapper component
 * Wraps the EntitiesContent component and handles client-side state for agricultural entities
 *
 * User steps:
 * 1. User visits the GreenFood agricultural entities page
 * 2. Component initializes with server-side props for agricultural entities
 * 3. Component updates state based on URL search params with farming focus
 * 4. User can interact with agricultural entities list (view farms, cooperatives, food producers, sort, filter, paginate)
 *
 * @param {EntitiesWrapperProps} props - The props for the GreenFood EntitiesWrapper component
 * @returns {JSX.Element} The rendered GreenFood agricultural EntitiesWrapper component
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

  // React 19 useTransition for non-blocking filter updates
  const [isPending, startTransition] = useTransition()

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
    if (filterParam) startTransition(() => setFilter(filterParam))
  }, [searchParams, mounted])

  // Show loading state until mounted to prevent hydration mismatches
  if (!mounted) {
    return (
      <EntitySuspenseBoundary
        level="page"
        showProgress={true}
        description="Preparing GreenFood agricultural entities directory for sustainable farming discovery"
        retryEnabled={false}
      >
        <div />
      </EntitySuspenseBoundary>
    )
  }

  return (
    <div>
      {/* Main Navigation Bar for GreenFood Agricultural Entities */}
      <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20 border-b border-emerald-200 dark:border-emerald-800 mb-6">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
                <Building2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-emerald-800 dark:text-emerald-200">
                  {t('title', { defaultValue: 'Agricultural Entities' })}
                </h1>
                <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
                  {t('subtitle', { defaultValue: 'Discover farms, cooperatives, and food producers in sustainable agriculture' })}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {session?.user && (
                <>
                  {/* Add Agricultural Entity Button */}
                  <AddEntityButton
                    locale={locale as any}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <EntitySuspenseBoundary
        level="page"
        showProgress={true}
        description="Loading GreenFood agricultural entities directory with sustainable farming focus"
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

