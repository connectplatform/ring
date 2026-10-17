'use client'

import React, { useState, useEffect } from 'react'
import { getSystemConfigSnapshot } from '@/lib/ring-config-core'
import AnimatedLogoInner from './animated-logo-content'

export interface AnimatedLogoProps {
  size?: number
  className?: string
  /** Full-spectrum hyperspace swirl (roadmap warp finale). Always the canvas. */
  vibrant?: boolean
  /** Ring illustrations (tap game, docs). Always the canvas, even when a clone sets a logo. */
  canvas?: boolean
}

const COMMUNITY_LOGO = '/images/logo-light.svg'

function brandLogoUrl(): string | null {
  const branding = (getSystemConfigSnapshot() as { branding?: { logo?: { light?: string } } }).branding
  const url = branding?.logo?.light?.trim()
  // The template default is merged into every clone. Only a real overlay path
  // (Cherkasy sets /logo.svg) replaces the canvas.
  if (!url || url === COMMUNITY_LOGO) return null
  return url
}

/**
 * Chrome mark. A clone with `branding.logo.light` (L3 `public/logo.svg`) shows that
 * image in the desktop rail and the mobile button. Community Layer 1 leaves the
 * key unset and keeps the Three.js ring.
 *
 * The canvas must not run during SSR. Mount-gate it — do not use next/dynamic
 * `{ ssr: false }` (Next.js 16 cacheComponents CSR-bails the whole route).
 */
export default function AnimatedLogo({ size = 77, className, vibrant, canvas }: AnimatedLogoProps) {
  const logoUrl = !vibrant && !canvas ? brandLogoUrl() : null
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        className={className}
      />
    )
  }

  if (!isMounted) {
    return null
  }

  return (
    <div className={className}>
      <AnimatedLogoInner size={size} vibrant={vibrant} />
    </div>
  )
}
