'use client'

import React from 'react'
import { OpportunitiesSearchBar } from './opportunities-search-bar'
import { AdvancedFiltersWithSearch } from './advanced-filters-with-search'

interface OpportunitiesSearchClientProps {
  locale: string
}

export default function OpportunitiesSearchClient({ locale }: OpportunitiesSearchClientProps) {
  return (
    <>
      <OpportunitiesSearchBar />

      {/* Filter Sidebar Toggle - Mobile */}
      <div className="md:hidden">
        <AdvancedFiltersWithSearch />
      </div>

      {/* Desktop Filter Sidebar */}
      <div className="hidden md:block w-80 flex-shrink-0">
        <div className="sticky top-32">
          <AdvancedFiltersWithSearch />
        </div>
      </div>
    </>
  )
}
