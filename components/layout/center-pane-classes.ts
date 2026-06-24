/**
 * SSOT class strings for DaVinci immersive center panes (customer-facing modules).
 * Parent RingContentPanel must use flush classes so the pane fills edge-to-edge.
 */
export const RING_FLUSH_CENTER_PANE =
  'ring-content-panel-flush !p-0 !shadow-none !bg-transparent min-h-full'

/** Flush pane + mobile bottom padding for floating right-rail toggle. */
export const RING_FLUSH_CENTER_PANE_MOBILE = `${RING_FLUSH_CENTER_PANE} pb-24 lg:pb-0`
