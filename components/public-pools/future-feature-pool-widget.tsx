'use client'

/**
 * App-wide future-feature pool card — use on `/dao`, marketing pages, or anywhere outside docs MDX.
 * Pass `poolSlug` when the pool already exists; optionally set `docPath` for ensure/slug derivation.
 */
import React from 'react'
import { FutureFeatureWidget } from '@/components/docs/future-feature-widget'
import { PublicPoolPathProvider } from '@/components/docs/docs-pool-context'
import type { FutureFeatureWidgetData } from '@/lib/docs/future-feature-types'

export type FutureFeaturePoolWidgetProps = FutureFeatureWidgetData & {
  /** Docs-style path segment, e.g. `en/architecture/data-model` — used when poolSlug is omitted. */
  docPath?: string
}

export function FutureFeaturePoolWidget({
  docPath = 'app',
  ...props
}: FutureFeaturePoolWidgetProps) {
  return (
    <PublicPoolPathProvider docPath={docPath}>
      <FutureFeatureWidget {...props} />
    </PublicPoolPathProvider>
  )
}

export { FutureFeatureBacklog } from '@/components/docs/future-feature-widget'
