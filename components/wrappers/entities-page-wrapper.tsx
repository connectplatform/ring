'use client'

import React from 'react'
import type { Locale } from '@/i18n/shared'

interface EntitiesPageWrapperProps {
  children: React.ReactNode
  locale: Locale
}

/**
 * Entities layout shell — section nav lives in the right rail (`EntitiesNavRail`).
 * Do not reintroduce ModuleSectionNav here (duplicate of rail + double-locale risk).
 */
export default function EntitiesPageWrapper({ children }: EntitiesPageWrapperProps) {
  return <div className="min-h-full">{children}</div>
}
