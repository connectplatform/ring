'use client'

import { eventBus } from '@/lib/event-bus.client'

/**
 * Request the opportunity type selector on every viewport.
 * `AddOpportunityFsModal` (hosted in BottomNavigation) opens the shared FsModal.
 * Always returns true: the request was delegated to the shared host.
 */
export function requestOpportunityTypeSelector(): boolean {
  eventBus.emit('opportunity:open-type-selector', {})
  return true
}
