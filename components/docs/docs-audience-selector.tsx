'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { useDocsAudienceOptional } from '@/components/docs/docs-audience-context'
import type { DocsAudience } from '@/lib/docs/docs-audience'

const AUDIENCE_OPTIONS: DocsAudience[] = ['founder', 'developer']

export default function DocsAudienceSelector() {
  const ctx = useDocsAudienceOptional()
  const t = useTranslations('navigation.docs_sidebar.audience')

  if (!ctx) return null

  const { audience, setAudience } = ctx

  return (
    <div className="space-y-2">
      <div
        role="tablist"
        aria-label={t('title')}
        className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-muted/60"
      >
        {AUDIENCE_OPTIONS.map((option) => {
          const active = audience === option
          return (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setAudience(option)}
              className={cn(
                'text-xs font-medium rounded-md px-2 py-1.5 transition-colors',
                active
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t(option)}
            </button>
          )
        })}
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground pl-3">
        {t(`${audience}Hint`)}
      </p>
    </div>
  )
}
