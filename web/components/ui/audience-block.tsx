'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { useDocsAudienceOptional } from '@/components/docs/docs-audience-context'
import {
  audienceBlockVisible,
  type DocsAudienceTarget,
} from '@/lib/docs/docs-audience'

// Define the props for the Audience block component
export interface AudienceBlockProps {
  /** MDX authors use the `for` prop for audience — aliased here as well as `audience`. */
  for?: DocsAudienceTarget  // Specifies which audience to show this block for.
  audience?: DocsAudienceTarget  // Alternative prop name for specifying audience.
  children: React.ReactNode     // Children content to render inside the block.
  className?: string            // Additional CSS classes for styling.
}

/**
 * Client-side audience gate for dual-audience MDX articles.
 * 
 * - If this block is *not* wrapped by a DocsAudienceProvider context, always render the children.
 * - If wrapped, filters children by sidebar tab — visible if `audienceBlockVisible` matches current audience.
 * 
 * Unwrapped blocks always render; wrapped blocks filter by sidebar tab.
 */
export function Audience({
  for: forProp,
  audience: audienceProp,
  children,
  className
}: AudienceBlockProps) {

  // Get optional DocsAudience context from provider (null if outside provider)
  const ctx = useDocsAudienceOptional()

  // Determine the audience target: 
  // 1. If `for` is set, use that
  // 2. Else if `audience` is set, use that
  // 3. Default to 'both' (no filtering)
  const target = forProp ?? audienceProp ?? 'both'

  // If there is no context provided, just render children unconditionally
  if (!ctx) {
    // No context present, so show for all audiences.
    return <div className={className}>{children}</div>
  }

  // Determine visibility: should this block be visible for the current audience?
  const visible = audienceBlockVisible(ctx.audience, target)

  // Render the block, optionally hidden if not visible for current audience.
  // Attach audience metadata for testing/debugging.
  return (
    <div
      data-docs-audience-block={target}
      aria-hidden={!visible}
      className={cn(!visible && 'hidden', className)}
    >
      {children}
    </div>
  )

  // TODO: In React 19+ and Next.js 16, could consider using `use` for context 
  // and [React Compiler/server components hooks] when available, for more idiomatic context patterns.
  // For now, this is the idiomatic 'use client' pattern.
}
