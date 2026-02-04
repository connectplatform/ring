'use client'

import React from 'react'
import dynamic from 'next/dynamic'

const RingLogoWithFlagContent = dynamic(() => import('./ring-logo-with-flag-content'), {
  ssr: false,
})

export default function RingLogoWithFlag() {
  return <RingLogoWithFlagContent />
}