'use client'

import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

const AnimatedLogoInner = dynamic(() => import('./animated-logo-content'), {
  ssr: false,
})

export interface AnimatedLogoProps {
  size?: number
  className?: string
}

export default function AnimatedLogo({ size, className }: AnimatedLogoProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return null
  }

  return (
    <div className={className}>
      <AnimatedLogoInner size={size} />
    </div>
  )
}