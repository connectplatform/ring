/**
 * React 19 Resource Preloading Configuration
 * Optimizes resource loading for better performance
 */

import { prefetchDNS, preconnect, preload, preinit } from 'react-dom'

export function setupResourcePreloading() {
  // Only preload truly critical resources that are used immediately on every page
  // Removed most preloads to eliminate "unused preload" warnings

  // DNS prefetch only for absolutely critical external services used on initial load
  prefetchDNS('https://fonts.googleapis.com')
  prefetchDNS('https://fonts.gstatic.com')

  // Critical Firebase connections (only if Firebase is used immediately)
  if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    prefetchDNS('https://api.firebase.google.com')
    preconnect('https://firebasestorage.googleapis.com')
  }

  // Web3Auth connections only if crypto wallet is the primary feature
  // prefetchDNS('https://web3auth.io') // Disabled to reduce preload warnings

  // Font preloading is now handled by next/font/google with explicit weight configuration
  // This eliminates unnecessary font weight preloads

  // Script preloading removed - scripts should be loaded on-demand
  // Firebase messaging and analytics are not critical for initial page load

  // Logo/favicon preloading removed - these are small files loaded immediately
  // when referenced in HTML, no need for explicit preload

  // Preconnect to CDN if using one
  if (process.env.NEXT_PUBLIC_CDN_URL) {
    preconnect(process.env.NEXT_PUBLIC_CDN_URL)
  }

  // Preconnect to API URL if different from app
  if (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL !== '/') {
    try {
      const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL)
      preconnect(apiUrl.origin)
    } catch (error) {
      // Invalid URL, skip
    }
  }
}
