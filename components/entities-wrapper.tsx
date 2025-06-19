"use client"

import { Suspense, useState, useEffect } from "react"
import dynamic from "next/dynamic"
import type { Entity } from "@/types"
import { useSearchParams } from "next/navigation"

/**
 * Dynamically import the EntitiesContent component
 * This allows for code splitting and improved performance
 */
const EntitiesContent = dynamic(() => import("@/features/entities/components/entities"), {
  loading: () => <LoadingFallback />,
})

/**
 * LoadingFallback component
 * Displays a loading message while the EntitiesContent is being loaded
 *
 * @returns {JSX.Element} A div with a loading message
 */
function LoadingFallback() {
  return <div className="text-center py-8">Loading directory...</div>
}

/**
 * EntitiesWrapperProps interface
 * Defines the props for the EntitiesWrapper component
 *
 * @typedef {Object} EntitiesWrapperProps
 * @property {Entity[]} initialEntities - Initial list of entities to display
 * @property {string | null} initialError - Initial error message, if any
 * @property {number} page - Initial page number
 * @property {number} totalPages - Total number of pages
 * @property {number} totalEntities - Total number of entities
 * @property {string | null} lastVisible - Last visible entity for pagination
 * @property {number} initialLimit - Initial number of entities per page
 * @property {string} initialSort - Initial sort order
 * @property {string} initialFilter - Initial filter applied
 */
interface EntitiesWrapperProps {
  initialEntities: Entity[]
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
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)
  const [entities, setEntities] = useState<Entity[]>(initialEntities)
  const [error, setError] = useState<string | null>(initialError)
  const [limit, setLimit] = useState(initialLimit)
  const [sort, setSort] = useState(initialSort)
  const [filter, setFilter] = useState(initialFilter)

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
    return <LoadingFallback />
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
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
    </Suspense>
  )
}

