'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { initWebVitals, setWebVitalsUserId } from '@/lib/web-vitals'

/**
 * Web Vitals Provider Component
 * 
 * React 19 Performance Monitoring Integration
 * 
 * Features:
 * - Automatic Web Vitals collection on client-side
 * - User attribution for authenticated sessions
 * - React 19 optimization tracking
 * - Performance baseline establishment
 * 
 * Usage:
 * - Add to root layout for global monitoring
 * - Automatically starts collecting Core Web Vitals
 * - Sends metrics to /api/analytics/web-vitals
 * 
 * @returns JSX.Element | null
 */
export function WebVitalsProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()

  useEffect(() => {
    // Initialize Web Vitals collection on client-side
    if (typeof window !== 'undefined') {
      // Initialize with user ID if available
      const userId = session?.user?.id
      initWebVitals(userId)
      
      // Track React 19 specific performance benefits
      if (userId) {
        setWebVitalsUserId(userId)
      }
      
      // Log initialization for debugging
      if (process.env.NODE_ENV === 'development') {
        console.log('🚀 Web Vitals monitoring initialized', {
          userId: userId || 'anonymous',
          react19Features: [
            'useTransition',
            'useDeferredValue',
            'useActionState',
            'useFormStatus',
            'nativeIntersectionObserver'
          ]
        })
      }
    }
  }, [session?.user?.id])

  // Update user ID when session changes
  useEffect(() => {
    if (session?.user?.id) {
      setWebVitalsUserId(session.user.id)
    }
  }, [session?.user?.id])

  return <>{children}</>
}

/**
 * React 19 Performance Monitoring Hook
 * 
 * Provides access to Web Vitals functionality in components
 * 
 * @returns Web Vitals utilities
 */
export function useWebVitalsMonitoring() {
  const { data: session } = useSession()
  
  return {
    isMonitoring: typeof window !== 'undefined',
    userId: session?.user?.id,
    features: {
      react19: true,
      useTransition: true,
      useDeferredValue: true,
      useActionState: true,
      useFormStatus: true,
      nativeIntersectionObserver: true,
    }
  }
} 