/**
 * React 19 Resource Preloading Configuration
 * Optimizes resource loading for better performance
 */

import { prefetchDNS, preconnect, preload, preinit } from 'react-dom'

export function setupResourcePreloading() {
  // DNS prefetch for external services
  prefetchDNS('https://api.firebase.google.com')
  prefetchDNS('https://fonts.googleapis.com')
  prefetchDNS('https://www.googleapis.com')
  prefetchDNS('https://apis.google.com')
  prefetchDNS('https://fonts.gstatic.com')
  
  // Critical connections for Firebase services
  preconnect('https://firebasestorage.googleapis.com')
  preconnect('https://identitytoolkit.googleapis.com')
  preconnect('https://firebaseapp.com')
  preconnect('https://firebaseio.com')
  
  // Web3Auth connections if using crypto wallet
  prefetchDNS('https://web3auth.io')
  prefetchDNS('https://api.web3auth.io')
  
  // Preload critical fonts
  preload('/fonts/Inter-Bold.woff2', { 
    as: 'font', 
    type: 'font/woff2',
    crossOrigin: 'anonymous' 
  })
  
  // Preload Inter font variations if they exist
  const fontVariations = ['Inter-Regular', 'Inter-Medium', 'Inter-SemiBold']
  fontVariations.forEach(font => {
    try {
      preload(`/fonts/${font}.woff2`, { 
        as: 'font', 
        type: 'font/woff2',
        crossOrigin: 'anonymous' 
      })
    } catch (error) {
      // Silently ignore if font file doesn't exist
    }
  })
  
  // Preinit critical scripts
  if (typeof window !== 'undefined') {
    // Firebase messaging service worker
    try {
      preinit('/firebase-messaging-sw.js', { as: 'script' })
    } catch (error) {
      console.debug('Firebase messaging SW not available')
    }
    
    // Analytics script if exists
    try {
      preinit('/scripts/analytics.js', { as: 'script' })
    } catch (error) {
      console.debug('Analytics script not available')
    }
  }
  
  // Preload app logo and critical images
  preload('/logo.svg', { as: 'image' })
  preload('/favicon.ico', { as: 'image' })
  
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
