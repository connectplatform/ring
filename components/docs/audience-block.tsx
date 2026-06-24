'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { useDocsAudienceOptional } from '@/components/docs/docs-audience-context'
import {
  audienceBlockVisible,
  type DocsAudienceTarget,
} from '@/lib/docs/docs-audience'

export interface AudienceBlockProps {
  /** MDX authors use `for="founder"` — aliased here. */
  for?: DocsAudienceTarget
  audience?: DocsAudienceTarget
  children: React.ReactNode
  className?: string
}

/**
 * Client-side audience gate for dual-audience MDX articles.
 * Unwrapped blocks always render; wrapped blocks filter by sidebar tab.
 */
export function Audience({ for: forProp, audience: audienceProp, children, className }: AudienceBlockProps) {
  const ctx = useDocsAudienceOptional()
  const target = forProp ?? audienceProp ?? 'both'

  if (!ctx) {
    return <div className={className}>{children}</div>
  }

  const visible = audienceBlockVisible(ctx.audience, target)

  return (
    <div
      data-docs-audience-block={target}
      aria-hidden={!visible}
      className={cn(!visible && 'hidden', className)}
    >
      {children}
    </div>
  )
}
