'use client'

import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

const AnimatedLogoInner = dynamic(() => import('./animated-logo-content'), {
  ssr: false,
})

export default function AnimatedLogo() {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return null // Render nothing until the component is mounted
  }

  return (
      <AnimatedLogoInner />
  )
}