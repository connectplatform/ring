'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { RingTapGame } from '@/components/common/widgets/ring-tap-game'
import { cn } from '@/lib/utils'

/**
 * 50% viewport-width Ring logo — mobile + tablet only (hidden lg+).
 * Tap to grow/shrink; burst at bounds spawns a gold RING coin.
 */
export function HeroMobileLogo({ className }: { className?: string }) {
  const [logoSize, setLogoSize] = useState(160)

  useEffect(() => {
    const update = () => {
      const vwHalf = Math.round(window.innerWidth * 0.5)
      setLogoSize(Math.min(Math.max(vwHalf, 120), 320))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
      className={cn(
        'mx-auto mb-6 flex w-1/2 max-w-[320px] items-center justify-center lg:hidden',
        className
      )}
    >
      <RingTapGame baselineSize={logoSize} className="w-full" />
    </motion.div>
  )
}
