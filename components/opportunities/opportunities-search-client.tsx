'use client'

import React from 'react'
import { AdvancedFiltersWithSearch } from './advanced-filters-with-search'

interface OpportunitiesSearchClientProps {
  locale: string
}

/**
 * Opportunities Search Client Component
 * 
 * Single unified search and filter block with sticky positioning
 */
export default function OpportunitiesSearchClient({ locale }: OpportunitiesSearchClientProps) {
  return (
    <div className="sticky top-[4.5rem] z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4">
      <div className="container mx-auto px-4 pt-4">
        <div className="max-w-7xl mx-auto">
          <AdvancedFiltersWithSearch />
        </div>
      </div>
    </div>
  )
}
