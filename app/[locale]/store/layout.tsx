import React from 'react'

/**
 * Store Layout - Ring Platform
 * 
 * Wrappers (StoreWrapper, CheckoutWrapper, CartWrapper) handle their own sidebars.
 * This layout only provides a container - NO margin offset needed as wrappers
 * include the DesktopSidebar component directly.
 */
export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}


