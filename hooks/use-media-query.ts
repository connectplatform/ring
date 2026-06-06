'use client'

import { useEffect, useState } from 'react'
import { subscribeMediaQueryChange } from '@/lib/dom/subscribe-media-query-change'

export function useMediaQuery(query: string, defaultValue = false): boolean {
  const [matches, setMatches] = useState(defaultValue)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return () => {}
    }

    try {
      const mq = window.matchMedia(query)
      return subscribeMediaQueryChange(mq, setMatches)
    } catch {
      setMatches(defaultValue)
      return () => {}
    }
  }, [defaultValue, query])

  return matches
}
