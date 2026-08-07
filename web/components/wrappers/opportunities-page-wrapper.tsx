'use client'

import React from 'react'

interface OpportunitiesPageWrapperProps {
  children: React.ReactNode
  locale: string
  searchParams?: { [key: string]: string | string[] | undefined }
}

/**
 * Opportunities layout shell — section nav lives in the right rail (OpportunitiesNavRail).
 */
export default function OpportunitiesPageWrapper({ children }: OpportunitiesPageWrapperProps) {
  return <div className="relative min-h-full">{children}</div>
}
