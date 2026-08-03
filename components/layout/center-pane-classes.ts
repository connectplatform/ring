/**
 * SSOT class strings for DaVinci immersive center panes (customer-facing modules).
 * Parent RingContentPanel must use flush classes so the pane fills edge-to-edge.
 */
export const RING_FLUSH_CENTER_PANE =
  'ring-content-panel-flush !p-0 !shadow-none !bg-transparent min-h-full'

/**
 * Mobile bottom clearance for fixed bottom navigation.
 * Uses !pb so it wins over flush `!p-0` on the same element.
 */
export const RING_MOBILE_NAV_PAD =
  '!pb-[calc(var(--mobile-bottom-nav-h,3.5rem)+1.25rem)] lg:!pb-0'

/** Flush pane + mobile bottom padding for floating right-rail toggle / bottom nav. */
export const RING_FLUSH_CENTER_PANE_MOBILE = `${RING_FLUSH_CENTER_PANE} ${RING_MOBILE_NAV_PAD}`
