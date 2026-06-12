'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

const AnimatedLogo = dynamic(() => import('@/components/common/widgets/animated-logo'), {
  ssr: false,
})

type RingCoin = {
  id: string
  xOffset: number
  rotation: number
}

type RingTapGameProps = {
  baselineSize: number
  className?: string
}

function clampSize(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function RingCoinBurst({ coin }: { coin: RingCoin }) {
  return (
    <motion.div
      key={coin.id}
      initial={{ opacity: 1, y: 0, scale: 0.6, rotate: coin.rotation }}
      animate={{ opacity: 0, y: -120, scale: 1.1, rotate: coin.rotation + 24 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={{ marginLeft: coin.xOffset }}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-amber-300/80 shadow-lg"
        style={{
          background:
            'radial-gradient(circle at 30% 28%, #fff7c2 0%, #fbbf24 42%, #d97706 78%, #92400e 100%)',
        }}
      >
        <span className="text-[10px] font-black tracking-wider text-amber-950">RING</span>
      </div>
      <span className="mt-1 text-xs font-bold text-amber-500">+1</span>
    </motion.div>
  )
}

export function RingTapGame({ baselineSize, className }: RingTapGameProps) {
  const prefersReducedMotion = useReducedMotion()
  const [size, setSize] = useState(baselineSize)
  const [displayScale, setDisplayScale] = useState(1)
  const [bursting, setBursting] = useState(false)
  const [coins, setCoins] = useState<RingCoin[]>([])
  const [tapCount, setTapCount] = useState(0)
  const boundsRef = useRef({ min: 96, max: 420 })

  useEffect(() => {
    const updateBounds = () => {
      boundsRef.current = {
        min: 96,
        max: Math.min(Math.round(window.innerWidth * 0.9), 420),
      }
    }
    updateBounds()
    window.addEventListener('resize', updateBounds)
    return () => window.removeEventListener('resize', updateBounds)
  }, [])

  useEffect(() => {
    setSize((prev) => clampSize(prev, boundsRef.current.min, boundsRef.current.max))
  }, [baselineSize])

  const spawnCoin = useCallback(() => {
    const id = `coin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const coin: RingCoin = {
      id,
      xOffset: Math.round((Math.random() - 0.5) * 48),
      rotation: Math.round((Math.random() - 0.5) * 40),
    }
    setCoins((prev) => [...prev, coin])
    window.setTimeout(() => {
      setCoins((prev) => prev.filter((c) => c.id !== id))
    }, 900)
  }, [])

  const triggerBurst = useCallback(() => {
    setBursting(true)
    spawnCoin()
    setTapCount((c) => c + 1)

    if (prefersReducedMotion) {
      setSize(baselineSize)
      setDisplayScale(1)
      setBursting(false)
      return
    }

    setDisplayScale(1.35)
    window.setTimeout(() => {
      setSize(baselineSize)
      setDisplayScale(1)
      setBursting(false)
    }, 280)
  }, [baselineSize, prefersReducedMotion, spawnCoin])

  const handleTap = useCallback(() => {
    const { min, max } = boundsRef.current
    const delta = Math.round((Math.random() > 0.45 ? 1 : -1) * (20 + Math.random() * 40))
    const next = size + delta

    if (next <= min || next >= max) {
      triggerBurst()
      return
    }

    setTapCount((c) => c + 1)
    setSize(next)
    if (!prefersReducedMotion) {
      setDisplayScale(next > size ? 1.06 : 0.94)
      window.setTimeout(() => setDisplayScale(1), 180)
    }
  }, [prefersReducedMotion, size, triggerBurst])

  const logoSize = useMemo(() => Math.round(size), [size])

  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      <button
        type="button"
        aria-label="Tap the Ring logo"
        onClick={handleTap}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleTap()
          }
        }}
        className={cn(
          'relative cursor-pointer rounded-full border-0 bg-transparent p-0 outline-none',
          'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          bursting && !prefersReducedMotion && 'animate-pulse'
        )}
      >
        <motion.div
          animate={{ scale: displayScale, opacity: bursting && prefersReducedMotion ? 0.5 : 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 18 }}
          className="relative"
        >
          <AnimatedLogo size={logoSize} className="flex items-center justify-center" />
        </motion.div>
      </button>

      <AnimatePresence>
        {coins.map((coin) => (
          <RingCoinBurst key={coin.id} coin={coin} />
        ))}
      </AnimatePresence>

      {tapCount > 0 && (
        <span className="pointer-events-none absolute -bottom-1 right-0 text-[10px] font-medium text-muted-foreground/70">
          {tapCount}
        </span>
      )}
    </div>
  )
}
