'use client'

import { eventBus } from '@/lib/event-bus.client'

const MOBILE_MQ = '(max-width: 767px)'

/** True when viewport should use the bottom-nav mobile-sheet host. */
export function isOpportunitySelectorMobileViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(MOBILE_MQ).matches
}

/**
 * Request the opportunity type selector.
 * On mobile, BottomNavigation opens the shared `mobile-sheet` (survives sidebar close).
 * Returns true when the request was delegated to the mobile host; false = open local overlay.
 */
export function requestOpportunityTypeSelector(): boolean {
  if (!isOpportunitySelectorMobileViewport()) return false
  eventBus.emit('opportunity:open-type-selector', {})
  return true
}
