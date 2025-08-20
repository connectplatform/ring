'use client'

import React, { useEffect } from 'react'
import { useSession } from '@/components/providers/session-provider'
import { startWebVitalsCollection, setWebVitalsUserId } from '@/lib/web-vitals'

interface WebVitalsProviderProps {
  children: React.ReactNode
}

export function WebVitalsProvider({ children }: WebVitalsProviderProps) {
  const { data: session } = useSession()

  useEffect(() => {
    // Initialize Web Vitals collection
    const initWebVitals = async () => {
      try {
        await startWebVitalsCollection()
        
        // Set user ID if available
        if (session?.user?.id) {
          setWebVitalsUserId(session.user.id)
        }
      } catch (error) {
        console.error('Failed to initialize Web Vitals:', error)
      }
    }

    initWebVitals()
  }, [session])

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