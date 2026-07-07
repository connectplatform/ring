import React from 'react'

/**
 * Store Layout - Ring Platform
 * 
 * This component serves as a minimal wrapper for all store-related pages.
 * 
 * Logic:
 * - The component receives `children`, which represents nested content for the store.
 * - It returns the children as-is, without adding markup or logic.
 * 
 * Why no HTML container?
 * - The separate wrappers (StoreWrapper, CheckoutWrapper, CartWrapper) are responsible for their own layout, including sidebars and any visual structure. 
 * - This avoids redundant markup and CSS conflict.
 *
 * Note: No margin or padding offsets are set here since sidebars are handled in dedicated wrappers.
 *
 * // TODO: If using React 19 or Next.js 16+, consider if you can leverage new nested layout features with server components or slot convention for more flexible composition.
 */
export default function StoreLayout({ children }: { children: React.ReactNode }) {
  // Directly render children. This allows wrappers above to fully control layout.
  return <>{children}</>
}
