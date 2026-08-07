'use client'

import React, { useId, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ShoppingCart,
  Zap,
  CreditCard,
  Webhook,
  Shield,
  Database,
  Wallet,
  Coins,
  Users,
  ArrowRight,
  CheckCircle,
  Sparkles,
  Settings,
  Lock,
  Bell,
  FileText,
  ArrowDown,
  Info,
  AlertTriangle,
  XCircle,
  Eye,
  Heart,
  Star,
} from 'lucide-react'

type Locale = 'en' | 'uk' | 'ru'

export interface SpokeConfig {
  label: string
  icon: keyof typeof iconMap
  color: string
  description?: string
}

export interface RingWidgetFlowStepsFiveProps {
  locale?: Locale
  title?: string
  subtitle?: string
  centerLabel?: string
  centerIcon?: keyof typeof iconMap
  centerColor?: string
  /** Optional spoke override — defaults to built-in PaymentConductor spokes */
  spokes?: SpokeConfig[]
  connectionLabels?: {
    inbound?: string
    outbound?: string
  }
}

// Icon map for string-based icon selection
const iconMap = {
  ShoppingCart,
  Zap,
  CreditCard,
  Webhook,
  Shield,
  Database,
  Wallet,
  Coins,
  Users,
  ArrowRight,
  CheckCircle,
  Sparkles,
  Settings,
  Lock,
  Bell,
  FileText,
  ArrowDown,
  Info,
  AlertTriangle,
  XCircle,
  Eye,
  Heart,
  Star,
} as const

const translations: Record<Locale, { defaultTitle: string; defaultSubtitle: string }> = {
  en: {
    defaultTitle: 'Conductor Orchestration',
    defaultSubtitle: 'Watch the conductor orchestrate operations in real-time',
  },
  uk: {
    defaultTitle: 'Оркестрація Кондуктора',
    defaultSubtitle: 'Спостерігайте як кондуктор оркеструє операції в реальному часі',
  },
  ru: {
    defaultTitle: 'Оркестрация Кондуктора',
    defaultSubtitle: 'Наблюдайте как кондуктор оркестрирует операции в реальном времени',
  },
}

/**
 * Default PaymentConductor spokes — always shown unless explicitly overridden.
 * These are the conceptual participants in the PaymentConductor's orchestration.
 */
const DEFAULT_SPOKES: SpokeConfig[] = [
  { label: 'UI/Checkout', icon: 'ShoppingCart', color: '#10b981', description: 'User initiates payment request' },
  { label: 'WayForPay', icon: 'CreditCard', color: '#3b82f6', description: 'Ukrainian payment gateway' },
  { label: 'Stripe', icon: 'CreditCard', color: '#8b5cf6', description: 'Global payment processor' },
  { label: 'Credit', icon: 'Wallet', color: '#f59e0b', description: 'Internal RING credit balance' },
  { label: 'Webhook', icon: 'Webhook', color: '#ec4899', description: 'Payment status callbacks' },
  { label: 'Handlers', icon: 'Shield', color: '#6366f1', description: 'Store / Membership / News logic' },
  { label: 'Ledger', icon: 'Database', color: '#0ea5e9', description: 'payment_transactions SSOT' },
]

export function RingWidgetFlowStepsFive({
  locale = 'en',
  title,
  subtitle,
  centerLabel = 'PaymentConductor',
  centerIcon = 'Zap',
  centerColor = 'from-amber-500 to-orange-600',
  spokes,
  connectionLabels = { inbound: 'Request', outbound: 'Response' },
}: RingWidgetFlowStepsFiveProps) {
  // Always have a default visual — no empty-state risk
  const activeSpokes: SpokeConfig[] = spokes && spokes.length > 0 ? spokes : DEFAULT_SPOKES

  const t = translations[locale]
  const reduced = useReducedMotion()
  const uid = useId().replace(/:/g, '')

  // Resolve icons from string names
  const CenterIconComponent = iconMap[centerIcon]
  const spokeIcons = activeSpokes.map((spoke) => iconMap[spoke.icon])

  // Calculate spoke positions in a circle (5:3 vertical — positions scale to container)
  const spokePositions = useMemo(() => {
    const count = activeSpokes.length
    // For vertical container, we need to account for width < height
    // Use elliptical distribution to keep spokes visible
    const radiusX = 36 // % of width from center
    const radiusY = 28 // % of height from center (smaller to fit vertical layout)
    return activeSpokes.map((_, i) => {
      const angle = (i / count) * 2 * Math.PI - Math.PI / 2 // Start from top
      const x = 50 + radiusX * Math.cos(angle)
      const y = 50 + radiusY * Math.sin(angle)
      return { x, y, angle }
    })
  }, [activeSpokes.length])

  return (
    <figure className="my-8 w-full max-w-xl mx-auto">
      <figcaption className="text-center mb-3">
        <h3 className="text-lg font-bold text-foreground">{title ?? t.defaultTitle}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle ?? t.defaultSubtitle}</p>
      </figcaption>

      {/* 5:3 vertical (portrait) container — fixed width, taller height */}
      <div className="relative w-full mx-auto" style={{ aspectRatio: '3/5', maxWidth: '360px' }}>
        <div className="absolute inset-0 rounded-2xl border border-border bg-gradient-to-br from-background via-muted/10 to-muted/30 overflow-hidden shadow-lg">
          {/* SVG Layer for connections (background) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
            <defs>
              <linearGradient id={`${uid}-inbound`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgb(99 102 241)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="rgb(99 102 241)" stopOpacity="0.9" />
              </linearGradient>
              <linearGradient id={`${uid}-outbound`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity="0.9" />
                <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0.4" />
              </linearGradient>
              <filter id={`${uid}-glow`}>
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Connection lines from spokes to center */}
            {spokePositions.map((pos, i) => (
              <g key={`conn-${i}`}>
                <line
                  x1={`${pos.x}%`}
                  y1={`${pos.y}%`}
                  x2="50%"
                  y2="50%"
                  stroke={`url(#${uid}-inbound)`}
                  strokeWidth="1.5"
                  opacity={reduced ? 0.4 : 0.5}
                />
                {!reduced && (
                  <motion.circle
                    r="2.5"
                    fill={activeSpokes[i].color}
                    filter={`url(#${uid}-glow)`}
                    initial={{ cx: `${pos.x}%`, cy: `${pos.y}%`, opacity: 0 }}
                    animate={{
                      cx: ['50%', `${pos.x}%`],
                      cy: ['50%', `${pos.y}%`],
                      opacity: [0, 1, 1, 0],
                    }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      delay: i * 0.35,
                      ease: 'easeInOut',
                    }}
                  />
                )}
              </g>
            ))}
          </svg>

          {/* Center hub — conductor */}
          <motion.div
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20"
            animate={reduced ? {} : { scale: [1, 1.06, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="relative">
              {/* Outer glow ring */}
              <div className="absolute inset-0 -m-2 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-600/20 blur-md" aria-hidden />
              {/* Main hub circle */}
              <div
                className={`relative w-20 h-20 rounded-full bg-gradient-to-br ${centerColor} flex items-center justify-center shadow-2xl border-4 border-background`}
              >
                {CenterIconComponent && <CenterIconComponent className="w-10 h-10 text-white" />}
              </div>
              {/* Label below hub */}
              <div className="absolute -bottom-7 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                <span className="text-[10px] font-bold text-foreground bg-background/90 backdrop-blur-sm px-2 py-0.5 rounded-full border border-border shadow-sm">
                  {centerLabel}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Orbiting spoke elements */}
          {spokePositions.map((pos, i) => {
            const spoke = activeSpokes[i]
            const Icon = spokeIcons[i]
            return (
              <motion.div
                key={`spoke-${i}`}
                className="absolute z-10"
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                initial={reduced ? false : { opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + i * 0.08, duration: 0.4 }}
              >
                <div className="relative group flex flex-col items-center">
                  {/* Spoke circle */}
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg border-2 transition-transform group-hover:scale-110"
                    style={{
                      background: `${spoke.color}25`,
                      borderColor: spoke.color,
                    }}
                  >
                    {Icon && <Icon className="w-5 h-5" style={{ color: spoke.color }} />}
                  </div>
                  {/* Label below spoke */}
                  <div className="mt-1 whitespace-nowrap">
                    <span
                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded border"
                      style={{
                        background: `${spoke.color}15`,
                        borderColor: `${spoke.color}50`,
                        color: spoke.color,
                      }}
                    >
                      {spoke.label}
                    </span>
                  </div>
                  {/* Hover tooltip with description */}
                  {spoke.description && (
                    <div className="absolute top-full mt-1 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30 w-32">
                      <div className="bg-popover text-popover-foreground text-[10px] p-1.5 rounded shadow-lg border border-border text-center">
                        {spoke.description}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}

          {/* Connection labels legend (bottom) */}
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-3 text-[9px] text-muted-foreground">
            {connectionLabels.inbound && (
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-indigo-500 rounded" />
                {connectionLabels.inbound}
              </span>
            )}
            {connectionLabels.outbound && (
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-emerald-500 rounded" />
                {connectionLabels.outbound}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footnote — what this visual represents */}
      <p className="text-center text-[10px] text-muted-foreground mt-2 italic">
        Conceptual visualization — not wired to live conductor process
      </p>
    </figure>
  )
}
