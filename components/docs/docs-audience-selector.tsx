'use client'

// Import React and relevant hooks/utilities.
import React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { useDocsAudienceOptional } from '@/components/docs/docs-audience-context'
import type { DocsAudience } from '@/lib/docs/docs-audience'

// Define possible audience options.
// TODO: If audience options grow, consider fetching or deriving this list dynamically.
const AUDIENCE_OPTIONS: DocsAudience[] = ['founder', 'developer']

/**
 * Documentation audience selector component.
 * Allows the user to select between different documentation audiences ("founder", "developer").
 */
export default function DocsAudienceSelector() {
  // Retrieve audience context (selected audience and method to set audience).
  const ctx = useDocsAudienceOptional()

  // Retrieve translation function scoped to "navigation.docs_sidebar.audience".
  const t = useTranslations('navigation.docs_sidebar.audience')

  // If context is unavailable, do not render the selector. Defensive null-check.
  if (!ctx) return null

  // Destructure current audience and setter function from context.
  const { audience, setAudience } = ctx

  return (
    <div className="space-y-2">
      {/* Tab-style controls for each audience option. */}
      <div
        role="tablist"
        aria-label={t('title')} // Accessible label for the tablist.
        className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-muted/60"
      >
        {AUDIENCE_OPTIONS.map((option) => {
          // Check if this option is the currently selected audience
          const active = audience === option

          return (
            <button
              key={option} // React key for stable rendering.
              type="button"
              role="tab"
              aria-selected={active}
              // Update selection to the clicked audience option.
              // TODO: In React 19, consider using the experimental `useTransition` if `setAudience` triggers significant re-renders.
              onClick={() => setAudience(option)}
              // Note: `setAudience` is synchronous + cheap (writes one localStorage
              // key and updates the parent context). The panel that consumes the
              // audience already wraps its search filter in `useDeferredValue`
              // for typing responsiveness, so no `useTransition` is needed here.
              // See `docs-navigation-panel.tsx` for the deferred-filter pattern.
              className={cn(
                'text-xs font-medium rounded-md px-2 py-1.5 transition-colors',
                active
                  ? 'bg-background text-foreground shadow-sm' // Styles for active tab
                  : 'text-muted-foreground hover:text-foreground', // Styles for inactive tab
              )}
            >
              {t(option)} {/* Localized label for the audience option */}
            </button>
          )
        })}
      </div>
      {/* Display a contextual hint/explanation for the selected audience. */}
      <p className="text-[11px] leading-snug text-muted-foreground pl-3">
        {t(`${audience}Hint`)}
      </p>
    </div>
  )
}
