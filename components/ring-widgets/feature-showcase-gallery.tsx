/**
 * Feature Showcase Gallery Widget
 *
 * A horizontally scrollable showcase gallery displaying Ring Platform
 * feature cards with audience-filtered tabs (Founders / Developers).
 *
 * Styled with the Davinci glass system (BorderBeam + glass-surface).
 * Icons are placed in a dedicated top row for visual hierarchy.
 * Fills 100% of the parent container width.
 *
 * Data sources (SSOT):
 * - Founder tab → pages.json → home.hero.featureSystems.items (via useTranslations)
 * - Developer tab → welcome-features.ts (via getWelcomeFeatureExplorerCopy)
 * - Terms/labels → locale JSON arrays accessed via t.raw()
 *
 * Layout:
 * - Mobile (<768px):  3 columns visible (snap-scroll)
 * - iPad  (768–1023): 4 columns visible
 * - Desktop (≥1024):  6 columns visible
 *
 * Cards maintain 4:3 aspect ratio. The gallery scrolls horizontally (swipe)
 * so additional feature elements can be added without layout breakage.
 *
 * @author LegioX Commander
 * @version 3.0.0 — Davinci-glass surface, icon-top cards, full-width layout
 */
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  useShowcaseFeatures,
  type AudienceTab,
  type ShowcaseFeature,
} from '@/lib/ring-widgets/feature-showcase-data'
import { BorderBeam } from '@/lib/ui/davinci/border-beam'
import {
  davinciGlassSurface,
  davinciBeamInnerSurface,
  davinciAuthButtonLift,
} from '@/lib/ui/davinci/glass-surface'
import { cn } from '@/lib/utils'

/* ─── Feature card palette — tone-matched border/gradient/label colours ─── */

interface FeatureCardStyle {
  border: string
  gradient: string
  tone: string
  labels: Array<{ bg: string; text: string }>
}

const FEATURE_STYLES: Record<string, FeatureCardStyle> = {
  /* ── Founder features ── */
  store: {
    border: 'border-amber-500/30',
    gradient: 'from-amber-500/10 to-orange-500/5',
    tone: 'amber',
    labels: [
      { bg: 'bg-amber-100/80 dark:bg-amber-900/30', text: 'text-amber-800 dark:text-amber-200' },
      { bg: 'bg-amber-100/60 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300' },
      { bg: 'bg-amber-100/40 dark:bg-amber-900/15', text: 'text-amber-700 dark:text-amber-300' },
    ],
  },
  entities: {
    border: 'border-blue-500/30',
    gradient: 'from-blue-500/10 to-indigo-500/5',
    tone: 'blue',
    labels: [
      { bg: 'bg-blue-100/80 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-200' },
      { bg: 'bg-blue-100/60 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300' },
      { bg: 'bg-blue-100/40 dark:bg-blue-900/15', text: 'text-blue-700 dark:text-blue-300' },
    ],
  },
  wallet: {
    border: 'border-emerald-500/30',
    gradient: 'from-emerald-500/10 to-teal-500/5',
    tone: 'emerald',
    labels: [
      { bg: 'bg-emerald-100/80 dark:bg-emerald-900/30', text: 'text-emerald-800 dark:text-emerald-200' },
      { bg: 'bg-emerald-100/60 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-300' },
      { bg: 'bg-emerald-100/40 dark:bg-emerald-900/15', text: 'text-emerald-700 dark:text-emerald-300' },
    ],
  },
  staking: {
    border: 'border-fuchsia-500/30',
    gradient: 'from-fuchsia-500/10 to-pink-500/5',
    tone: 'fuchsia',
    labels: [
      { bg: 'bg-fuchsia-100/80 dark:bg-fuchsia-900/30', text: 'text-fuchsia-800 dark:text-fuchsia-200' },
      { bg: 'bg-fuchsia-100/60 dark:bg-fuchsia-900/20', text: 'text-fuchsia-700 dark:text-fuchsia-300' },
      { bg: 'bg-fuchsia-100/40 dark:bg-fuchsia-900/15', text: 'text-fuchsia-700 dark:text-fuchsia-300' },
    ],
  },
  messaging: {
    border: 'border-violet-500/30',
    gradient: 'from-violet-500/10 to-purple-500/5',
    tone: 'violet',
    labels: [
      { bg: 'bg-violet-100/80 dark:bg-violet-900/30', text: 'text-violet-800 dark:text-violet-200' },
      { bg: 'bg-violet-100/60 dark:bg-violet-900/20', text: 'text-violet-700 dark:text-violet-300' },
      { bg: 'bg-violet-100/40 dark:bg-violet-900/15', text: 'text-violet-700 dark:text-violet-300' },
    ],
  },
  opportunities: {
    border: 'border-amber-500/30',
    gradient: 'from-amber-400/10 to-orange-400/5',
    tone: 'amber',
    labels: [
      { bg: 'bg-amber-100/80 dark:bg-amber-900/30', text: 'text-amber-800 dark:text-amber-200' },
      { bg: 'bg-amber-100/60 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300' },
      { bg: 'bg-amber-100/40 dark:bg-amber-900/15', text: 'text-amber-700 dark:text-amber-300' },
    ],
  },
  nft: {
    border: 'border-sky-500/30',
    gradient: 'from-sky-500/10 to-blue-500/5',
    tone: 'sky',
    labels: [
      { bg: 'bg-sky-100/80 dark:bg-sky-900/30', text: 'text-sky-800 dark:text-sky-200' },
      { bg: 'bg-sky-100/60 dark:bg-sky-900/20', text: 'text-sky-700 dark:text-sky-300' },
      { bg: 'bg-sky-100/40 dark:bg-sky-900/15', text: 'text-sky-700 dark:text-sky-300' },
    ],
  },
  aiMatcher: {
    border: 'border-purple-500/30',
    gradient: 'from-purple-500/10 to-violet-500/5',
    tone: 'purple',
    labels: [
      { bg: 'bg-purple-100/80 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-200' },
      { bg: 'bg-purple-100/60 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-300' },
      { bg: 'bg-purple-100/40 dark:bg-purple-900/15', text: 'text-purple-700 dark:text-purple-300' },
    ],
  },
  erp: {
    border: 'border-emerald-500/30',
    gradient: 'from-emerald-600/10 to-green-600/5',
    tone: 'emerald',
    labels: [
      { bg: 'bg-emerald-100/80 dark:bg-emerald-900/30', text: 'text-emerald-800 dark:text-emerald-200' },
      { bg: 'bg-emerald-100/60 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-300' },
      { bg: 'bg-emerald-100/40 dark:bg-emerald-900/15', text: 'text-emerald-700 dark:text-emerald-300' },
    ],
  },
  /* ── Developer features ── */
  architecture: {
    border: 'border-slate-500/30',
    gradient: 'from-slate-500/10 to-gray-500/5',
    tone: 'slate',
    labels: [
      { bg: 'bg-slate-100/80 dark:bg-slate-900/30', text: 'text-slate-800 dark:text-slate-200' },
      { bg: 'bg-slate-100/60 dark:bg-slate-900/20', text: 'text-slate-700 dark:text-slate-300' },
      { bg: 'bg-slate-100/40 dark:bg-slate-900/15', text: 'text-slate-700 dark:text-slate-300' },
    ],
  },
  'data-model': {
    border: 'border-cyan-500/30',
    gradient: 'from-cyan-500/10 to-blue-500/5',
    tone: 'cyan',
    labels: [
      { bg: 'bg-cyan-100/80 dark:bg-cyan-900/30', text: 'text-cyan-800 dark:text-cyan-200' },
      { bg: 'bg-cyan-100/60 dark:bg-cyan-900/20', text: 'text-cyan-700 dark:text-cyan-300' },
      { bg: 'bg-cyan-100/40 dark:bg-cyan-900/15', text: 'text-cyan-700 dark:text-cyan-300' },
    ],
  },
  authentication: {
    border: 'border-indigo-500/30',
    gradient: 'from-indigo-500/10 to-violet-500/5',
    tone: 'indigo',
    labels: [
      { bg: 'bg-indigo-100/80 dark:bg-indigo-900/30', text: 'text-indigo-800 dark:text-indigo-200' },
      { bg: 'bg-indigo-100/60 dark:bg-indigo-900/20', text: 'text-indigo-700 dark:text-indigo-300' },
      { bg: 'bg-indigo-100/40 dark:bg-indigo-900/15', text: 'text-indigo-700 dark:text-indigo-300' },
    ],
  },
  tunnel: {
    border: 'border-teal-500/30',
    gradient: 'from-teal-500/10 to-cyan-500/5',
    tone: 'teal',
    labels: [
      { bg: 'bg-teal-100/80 dark:bg-teal-900/30', text: 'text-teal-800 dark:text-teal-200' },
      { bg: 'bg-teal-100/60 dark:bg-teal-900/20', text: 'text-teal-700 dark:text-teal-300' },
      { bg: 'bg-teal-100/40 dark:bg-teal-900/15', text: 'text-teal-700 dark:text-teal-300' },
    ],
  },
  'payment-conductor': {
    border: 'border-orange-500/30',
    gradient: 'from-orange-500/10 to-amber-500/5',
    tone: 'orange',
    labels: [
      { bg: 'bg-orange-100/80 dark:bg-orange-900/30', text: 'text-orange-800 dark:text-orange-200' },
      { bg: 'bg-orange-100/60 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300' },
      { bg: 'bg-orange-100/40 dark:bg-orange-900/15', text: 'text-orange-700 dark:text-orange-300' },
    ],
  },
  'video-conductor': {
    border: 'border-pink-500/30',
    gradient: 'from-pink-500/10 to-rose-500/5',
    tone: 'pink',
    labels: [
      { bg: 'bg-pink-100/80 dark:bg-pink-900/30', text: 'text-pink-800 dark:text-pink-200' },
      { bg: 'bg-pink-100/60 dark:bg-pink-900/20', text: 'text-pink-700 dark:text-pink-300' },
      { bg: 'bg-pink-100/40 dark:bg-pink-900/15', text: 'text-pink-700 dark:text-pink-300' },
    ],
  },
  security: {
    border: 'border-red-500/30',
    gradient: 'from-red-500/10 to-rose-500/5',
    tone: 'red',
    labels: [
      { bg: 'bg-red-100/80 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-200' },
      { bg: 'bg-red-100/60 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300' },
      { bg: 'bg-red-100/40 dark:bg-red-900/15', text: 'text-red-700 dark:text-red-300' },
    ],
  },
  api: {
    border: 'border-gray-500/30',
    gradient: 'from-gray-500/10 to-slate-500/5',
    tone: 'gray',
    labels: [
      { bg: 'bg-gray-100/80 dark:bg-gray-800/40', text: 'text-gray-800 dark:text-gray-200' },
      { bg: 'bg-gray-100/60 dark:bg-gray-800/30', text: 'text-gray-700 dark:text-gray-300' },
      { bg: 'bg-gray-100/40 dark:bg-gray-800/20', text: 'text-gray-700 dark:text-gray-300' },
    ],
  },
  mcp: {
    border: 'border-violet-400/30',
    gradient: 'from-violet-400/10 to-fuchsia-500/5',
    tone: 'violet',
    labels: [
      { bg: 'bg-violet-100/80 dark:bg-violet-900/30', text: 'text-violet-800 dark:text-violet-200' },
      { bg: 'bg-violet-100/60 dark:bg-violet-900/20', text: 'text-violet-700 dark:text-violet-300' },
      { bg: 'bg-violet-100/40 dark:bg-violet-900/15', text: 'text-violet-700 dark:text-violet-300' },
    ],
  },
  /* ── Legacy fallback (backwards compat) ── */
  'nft-market': {
    border: 'border-sky-500/30',
    gradient: 'from-sky-500/10 to-blue-500/5',
    tone: 'sky',
    labels: [
      { bg: 'bg-sky-100/80 dark:bg-sky-900/30', text: 'text-sky-800 dark:text-sky-200' },
      { bg: 'bg-sky-100/60 dark:bg-sky-900/20', text: 'text-sky-700 dark:text-sky-300' },
      { bg: 'bg-sky-100/40 dark:bg-sky-900/15', text: 'text-sky-700 dark:text-sky-300' },
    ],
  },
}

/* ─── Helpers ─── */

/** Compute visible column count based on viewport width (3→4→6) */
function useColumnCount(): number {
  const [cols, setCols] = useState(3)

  useEffect(() => {
    function compute() {
      const w = window.innerWidth
      if (w < 768) setCols(3)
      else if (w < 1024) setCols(4)
      else setCols(6)
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [])

  return cols
}

/* ─── Sub-components ─── */

/** Audience tab bar — styled consistently with DocsAudienceSelector */
function AudienceTabs({
  active,
  onChange,
  founderLabel,
  developerLabel,
}: {
  active: AudienceTab
  onChange: (tab: AudienceTab) => void
  founderLabel: string
  developerLabel: string
}) {
  return (
    <div
      role="tablist"
      aria-label="Feature audience"
      className="inline-flex items-center gap-1 rounded-lg bg-muted/60 p-0.5"
    >
      {(
        [
          { value: 'founder' as const, label: founderLabel },
          { value: 'developer' as const, label: developerLabel },
        ] as const
      ).map(({ value, label }) => {
        const activeTab = active === value
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={activeTab}
            onClick={() => onChange(value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200',
              activeTab
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

/** Individual feature card — Davinci-glass surface with centred top icon */
function FeatureCard({ feature }: { feature: ShowcaseFeature }) {
  const style = FEATURE_STYLES[feature.id] ?? FEATURE_STYLES.store
  const terms = feature.terms

  return (
    <BorderBeam
      duration="6s"
      className={cn(davinciGlassSurface, davinciAuthButtonLift, 'group')}
      innerClassName={cn(
        davinciBeamInnerSurface,
        'flex flex-col h-full p-3',
        'bg-gradient-to-br',
        style.gradient,
      )}
    >
      <a
        href={feature.href}
        className="flex flex-col items-center text-left no-underline h-full"
        style={{ aspectRatio: '4 / 3' }}
        aria-label={`${feature.title} — ${feature.description}`}
      >
        {/* ── Icon row — top centre ── */}
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-xl border text-lg',
            'bg-background/70',
            style.border.replace('/30', '/25'),
          )}
          aria-hidden
        >
          {feature.emoji}
        </span>

        {/* ── Title ── */}
        <span className="mt-2 text-xs font-semibold leading-tight text-center text-foreground group-hover:text-primary transition-colors">
          {feature.title}
        </span>

        {/* ── Description ── */}
        <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-center text-muted-foreground">
          {feature.description}
        </p>

        {/* ── Labels row — pinned to bottom ── */}
        {terms.length > 0 && (
          <div className="mt-auto flex flex-wrap justify-center gap-1 pt-2">
            {terms.map((term, ti) => {
              const labelStyle = style.labels[ti % style.labels.length]
              return (
                <span
                  key={term}
                  className={cn(
                    'inline-block rounded-full px-1.5 py-[1px] text-[9px] font-medium leading-tight',
                    labelStyle.bg,
                    labelStyle.text,
                  )}
                >
                  {term}
                </span>
              )
            })}
          </div>
        )}
      </a>
    </BorderBeam>
  )
}

/* ─── Main Component ─── */

export interface FeatureShowcaseGalleryProps {
  className?: string
}

/**
 * Feature Showcase Gallery v3
 *
 * Davinci-glass surfaced cards with centred icon on top row.
 * Full parent width, horizontal scroll, audience-switchable tabs.
 */
export function FeatureShowcaseGallery({ className }: FeatureShowcaseGalleryProps) {
  const [activeTab, setActiveTab] = useState<AudienceTab>('founder')
  const scrollRef = useRef<HTMLDivElement>(null)
  const cols = useColumnCount()
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  /* ── i18n-driven feature data ── */
  const currentItems: ShowcaseFeature[] = useShowcaseFeatures(activeTab)

  /* ── i18n for UI chrome ── */
  const tShowcase = useTranslations('pages.home.hero.featureSystems')
  const founderLabel: string = tShowcase('tabFounder')
  const developerLabel: string = tShowcase('tabDeveloper')

  /* ── Scroll state ── */
  const updateScrollState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', updateScrollState, { passive: true })
    updateScrollState()
    return () => el.removeEventListener('scroll', updateScrollState)
  }, [updateScrollState, currentItems])

  /* ── Scroll by one page ── */
  const scrollByPage = useCallback((direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const pageWidth = el.clientWidth
    el.scrollBy({
      left: direction === 'left' ? -pageWidth : pageWidth,
      behavior: 'smooth',
    })
  }, [])

  return (
    <section
      className={cn(
        'ring-widget-feature-showcase w-full max-w-full',
        className,
      )}
    >
      {/* ── Header row: title + audience tabs ── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
          {tShowcase('title')}
        </h2>
        <AudienceTabs
          active={activeTab}
          onChange={setActiveTab}
          founderLabel={founderLabel}
          developerLabel={developerLabel}
        />
      </div>

      {/* ── Gallery viewport — 100% width, no bleed ── */}
      <div className="relative">
        <div
          ref={scrollRef}
          className={cn(
            'overflow-x-auto scroll-smooth snap-x snap-mandatory',
            'scrollbar-hide overscroll-x-contain',
            'w-full',
          )}
          style={{ scrollbarWidth: 'none' } as React.CSSProperties}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              className="inline-grid grid-flow-col grid-rows-3 gap-3 px-0"
              initial={{ opacity: 0, x: activeTab === 'founder' ? -40 : 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: activeTab === 'founder' ? 40 : -40 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              {currentItems.map((feature, index) => (
                <div
                  key={feature.id}
                  className={cn(
                    'snap-start min-w-0',
                    // Width = (100vw - parent padding 2rem - gaps) / cols
                    'w-[calc((100vw-3.5rem)/3)]',                          // mobile:  3 cols
                    'md:w-[calc((100vw-4.25rem)/4)]',                      // tablet:  4 cols
                    'lg:w-[calc((min(100vw,1200px)-5.75rem)/6)]',          // desktop: 6 cols, capped at 1200
                  )}
                >
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: index * 0.04 }}
                    >
                      <FeatureCard feature={feature} />
                    </motion.div>
                  </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Desktop scroll arrows ── */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollByPage('left')}
            className={cn(
              'absolute left-1 top-1/2 -translate-y-1/2 z-20',
              'flex size-8 items-center justify-center rounded-full',
              'bg-background/90 border border-border shadow-sm',
              'text-muted-foreground hover:text-foreground',
              'transition-all hover:scale-110',
              'hidden md:flex',
            )}
            aria-label="Scroll left"
          >
            <ChevronLeft className="size-4" />
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollByPage('right')}
            className={cn(
              'absolute right-1 top-1/2 -translate-y-1/2 z-20',
              'flex size-8 items-center justify-center rounded-full',
              'bg-background/90 border border-border shadow-sm',
              'text-muted-foreground hover:text-foreground',
              'transition-all hover:scale-110',
              'hidden md:flex',
            )}
            aria-label="Scroll right"
          >
            <ChevronRight className="size-4" />
          </button>
        )}
      </div>

      {/* ── Pagination dots ── */}
      {currentItems.length > cols * 3 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {Array.from({
            length: Math.ceil(currentItems.length / (cols * 3)),
          }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                const el = scrollRef.current
                if (!el) return
                el.scrollTo({
                  left: i * el.clientWidth,
                  behavior: 'smooth',
                })
              }}
              className={cn(
                'size-1.5 rounded-full transition-all duration-200',
                'bg-muted-foreground/30 hover:bg-muted-foreground/60',
              )}
              aria-label={`Go to page ${i + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default FeatureShowcaseGallery
