'use client'

import React, { useState, useEffect } from 'react'
import AnimatedLogoInner from './animated-logo-content'

export interface AnimatedLogoProps {
  size?: number
  className?: string
  /** Full-spectrum hyperspace swirl (roadmap warp finale). */
  vibrant?: boolean
}

/**
 * Three.js canvas must not run during SSR (`document` / `window` in useMemo).
 * Mount-gate the inner canvas — do not use next/dynamic `{ ssr: false }`
 * (Next.js 16 cacheComponents CSR-bails the whole route).
 */
export default function AnimatedLogo({ size, className, vibrant }: AnimatedLogoProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return null
  }

  return (
    <div className={className}>
      <AnimatedLogoInner size={size} vibrant={vibrant} />
    </div>
  )
}
