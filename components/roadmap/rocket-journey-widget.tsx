'use client'

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
} from 'framer-motion'
import { Rocket, Sparkles, Crown, Zap, Maximize2, Minimize2, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { toggleThemeWithTransition } from '@/lib/theme/ring-theme-transition'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  BorderBeam,
  DavinciGlassChip,
  davinciBeamInnerSurface,
  davinciGlassSurface,
  davinciCtaPrimary,
} from '@/lib/ui/davinci'
import {
  type JourneyNode,
  indexToProgress,
  progressToIndex,
} from '@/lib/roadmap/build-journey'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import { Link, toAppHref } from '@/i18n/routing'
import { GithubIcon } from '@/components/ui/icons/github-icon'

const AnimatedLogo = dynamic(() => import('@/components/common/widgets/animated-logo'), {
  ssr: false,
})

export type RocketJourneyLabels = {
  nowLabel: string
  changelogCta: string
  githubCta: string
  ringdomCta: string
  futureBadge: string
  inProgressBadge: string
  plannedBadge: string
  dragHint: string
  empty: string
  axisFuture: string
  axisPast: string
}

type RocketJourneyWidgetProps = {
  nodes: JourneyNode[]
  labels: RocketJourneyLabels
  locale: Locale
  className?: string
}

const ROCKET_SIZE = 70 // 40 × 1.75
const LOGO_SIZE = 56
const NOW_MAGNET_RADIUS = 1.25
const WINDOW_RADIUS = 3
const GITHUB_REPO = 'https://github.com/connectplatform/ring'
const TAP_BOOST_MAX = 16
const HYPER_SPEED_THRESHOLD = 3.4
/** Star-Wars solid streak lines once boost hits max (16×). */
const WARP_LINES_SPEED = TAP_BOOST_MAX
/** Star / warp vanishing point — horizontal center, top 20% of the widget. */
const STAR_ORIGIN_X = 50
const STAR_ORIGIN_Y = 20
/** Letter-feed spawn — same as perspective vanishing point. */
const FEED_ORIGIN_X = STAR_ORIGIN_X
const FEED_ORIGIN_Y = STAR_ORIGIN_Y
/** Resume galaxy idle swirl after this many ms without interaction. */
const IDLE_AFTER_MS = 2800

const TILE_INK =
  '[text-shadow:0_1px_2px_hsl(var(--foreground)_/_0.4),0_0_1px_hsl(var(--foreground)_/_0.22)]'
const TILE_LINE =
  '[filter:drop-shadow(0_1px_1px_hsl(var(--foreground)_/_0.35))]'

function hashUnit(seed: string, salt: number): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (Math.abs(h) % 10_000) / 10_000
}

/** Radial emitter from the top-quarter vanishing point (always flies outward). */
type PerspectiveStarSpec = {
  id: string
  angleDeg: number
  /** Outward travel magnitude (vmin units) — soft/random, not edge-locked. */
  travel: number
  size: number
  opacity: number
  /** 0–1 phase so the field is pre-populated (negative animation delay). */
  phase: number
  /** Per-star duration multiplier (breaks synchronized bands). */
  durScale: number
  /** Where along the ray the loop starts (avoids shared rectangular shell). */
  startT: number
}

/** Max %-space distance from origin to the widget edge along a ray. */
function rayEdgeTravelPct(angleDeg: number): number {
  const rad = (angleDeg * Math.PI) / 180
  const ux = Math.cos(rad)
  const uy = Math.sin(rad)
  let t = Number.POSITIVE_INFINITY
  if (ux > 1e-4) t = Math.min(t, (100 - STAR_ORIGIN_X) / ux)
  else if (ux < -1e-4) t = Math.min(t, (0 - STAR_ORIGIN_X) / ux)
  if (uy > 1e-4) t = Math.min(t, (100 - STAR_ORIGIN_Y) / uy)
  else if (uy < -1e-4) t = Math.min(t, (0 - STAR_ORIGIN_Y) / uy)
  if (!Number.isFinite(t) || t <= 0) return 90
  return t
}

/**
 * Organic radial field — golden-angle + jitter, soft travel (not rectangle-edge locked),
 * fully random phases so no visible rectangular entropy shell forms.
 */
function buildPerspectiveStars(seed: string, count: number): PerspectiveStarSpec[] {
  const stars: PerspectiveStarSpec[] = []
  // Golden angle breaks regular polar banding; small hash jitter breaks lattice ghosts
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const angle =
      (i * golden + hashUnit(seed, i * 19 + 7) * 0.85 + hashUnit(seed, i * 53) * 0.4) %
      (Math.PI * 2)
    const angleDeg = (angle * 180) / Math.PI
    const edge = rayEdgeTravelPct(angleDeg)
    // Soft radii: most stars die/fade before the hard viewport rectangle
    // (sqrt bias → denser mid-field, fewer hard edge hits)
    const u = hashUnit(seed, i * 29 + 2)
    const v = hashUnit(seed, i * 71 + 11)
    const soft = 18 + Math.sqrt(u) * 55 + v * 28
    const travel = Math.min(edge * (0.55 + u * 0.9), soft)
    stars.push({
      id: `${seed}-p${i}`,
      angleDeg,
      travel,
      size: 0.9 + hashUnit(seed, i * 47) * 3.2,
      opacity: 0.28 + hashUnit(seed, i * 13) * 0.62,
      phase: hashUnit(seed, i * 41 + 3),
      durScale: 0.55 + hashUnit(seed, i * 61) * 1.15,
      startT: 0.04 + hashUnit(seed, i * 83) * 0.22,
    })
  }
  return stars
}

/**
 * Stars spawn along perspective rays (field pre-filled via phase).
 * At 16×, lines grow with warpProgress from the vanishing point to the edges.
 */
function WidgetStarfield({
  boostSpeed,
  warpProgress,
}: {
  boostSpeed: number
  /** 0–1 growth of warp lines while holding 16×. */
  warpProgress: number
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const perspectiveStars = useMemo(() => buildPerspectiveStars('sky-rays', 150), [])
  const warpLines = boostSpeed >= WARP_LINES_SPEED - 0.05
  const grow = Math.min(1, Math.max(0, warpProgress))
  // Stay on flying stars until rays have length — avoids a static starburst at the VP
  const mode: 'idle' | 'boost' | 'warp' =
    warpLines && grow > 0.1
      ? 'warp'
      : warpLines || boostSpeed > 1.08
        ? 'boost'
        : 'idle'
  const speedFactor = Math.min(TAP_BOOST_MAX, Math.max(1, boostSpeed))
  const boostDurBase = Math.max(0.16, 1.05 / Math.pow(speedFactor, 0.72))

  if (!mounted) {
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]"
      />
    )
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]"
    >
      <div className="ring-roadmap-perspective-layer absolute inset-0" data-mode={mode}>
        {perspectiveStars.map((star) => {
          const rad = (star.angleDeg * Math.PI) / 180
          const stretch = mode === 'warp' ? 1 : mode === 'boost' ? 1.08 : 1
          const travel = star.travel * stretch
          const dx = Math.cos(rad) * travel
          const dy = Math.sin(rad) * travel
          const base = Math.max(1.6, star.size * 1.1)
          const edgeLen = rayEdgeTravelPct(star.angleDeg)
          const dur =
            mode === 'warp'
              ? 0
              : mode === 'boost'
                ? boostDurBase * star.durScale
                : (7.5 + star.phase * 8) * star.durScale

          // Avoid Math.max(8,…) — that forced an instant starburst at grow≈0
          const warpW = grow <= 0.001 ? 0 : edgeLen * (1.05 + star.phase * 0.2) * grow
          const px = (n: number) => `${n.toFixed(3)}px`
          const num = (n: number, d = 5) => Number(n.toFixed(d))

          if (mode === 'warp') {
            if (warpW < 0.35) return null
            const hLine = Math.max(1.35, base * 0.32 + grow * 1.8)
            return (
              <span
                key={star.id}
                className="ring-roadmap-warp-line absolute rounded-full bg-[oklch(0.98_0.01_250)] shadow-[0_0_16px_oklch(0.98_0.02_250_/_0.95)] dark:bg-white dark:shadow-[0_0_20px_oklch(1_0_0_/_0.95)]"
                style={
                  {
                    left: `${STAR_ORIGIN_X}%`,
                    top: `${STAR_ORIGIN_Y}%`,
                    width: `${warpW.toFixed(3)}vmin`,
                    height: px(hLine),
                    marginTop: px(-hLine / 2),
                    opacity: num(0.2 + grow * 0.8, 4),
                    transform: `rotate(${star.angleDeg.toFixed(3)}deg)`,
                    transformOrigin: '0% 50%',
                  } as React.CSSProperties
                }
              />
            )
          }

          return (
            <span
              key={star.id}
              className={cn(
                'ring-roadmap-perspective-star absolute rounded-full',
                'bg-[oklch(0.72_0.14_250)] shadow-[0_0_10px_oklch(0.7_0.12_250_/_0.75)]',
                'dark:bg-[oklch(0.95_0.06_195)] dark:shadow-[0_0_12px_oklch(0.9_0.08_195_/_0.8)]',
              )}
              style={
                {
                  left: `${STAR_ORIGIN_X}%`,
                  top: `${STAR_ORIGIN_Y}%`,
                  width: px(base),
                  height: px(base),
                  marginLeft: px(-base / 2),
                  marginTop: px(-base / 2),
                  opacity: num(star.opacity),
                  '--star-o': String(num(star.opacity)),
                  '--hx': `${dx.toFixed(4)}vmin`,
                  '--hy': `${dy.toFixed(4)}vmin`,
                  '--start-t': star.startT.toFixed(5),
                  '--hyper-dur': `${dur.toFixed(5)}s`,
                  '--hyper-delay': `${(-star.phase * dur).toFixed(5)}s`,
                } as React.CSSProperties
              }
            />
          )
        })}
      </div>
    </div>
  )
}

/** Ionic exhaust beams — CSS class timing; boost via data-attr (no React animation shorthand). */
function IonicBeams({ active, boost }: { active: boolean; boost: boolean }) {
  if (!active) return null
  const beams = [0, 1, 2, 3, 4]
  return (
    <div
      aria-hidden
      data-boost={boost ? 'true' : undefined}
      className="ring-roadmap-ionic-beams pointer-events-none absolute left-1/2 top-full z-0 -translate-x-1/2"
    >
      {beams.map((i) => (
        <span
          key={i}
          className="ring-roadmap-ionic-beam absolute left-1/2 top-0 w-[2px] -translate-x-1/2 rounded-full bg-[var(--davinci-beam)]"
          style={
            {
              height: boost ? 56 : 40,
              boxShadow: '0 0 8px var(--davinci-beam)',
              '--bx': `${(i - 2) * (boost ? 5 : 3)}px`,
              '--beam-delay': `${i * (boost ? 0.04 : 0.07)}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}

function nodeAriaText(node: JourneyNode, labels: RocketJourneyLabels): string {
  if (node.kind === 'release') return `v${node.version} · ${node.date}`
  if (node.kind === 'now') return `${labels.nowLabel} · v${node.version}`
  return `${node.period} · ${node.title}`
}

/** Feed exit — past the widget edge so lines keep drifting out of view. */
const FEED_END_X = 108
const FEED_END_Y = 138
/** Path fraction at focus (delta≈0) — typewriter stays near the top. */
const FEED_FOCUS_T = 0.06
/** Depth range for perspective (far → near). Apparent size ∝ 1/z. Halved → 2× closer. */
const FEED_Z_FAR = 21
const FEED_Z_NEAR = 0.52
/** Reference size at z=1 — keeps far glyphs tiny, near glyphs looming. */
const FEED_APPARENT = 2.35

/**
 * Space-approach feed physics:
 * - Map journey delta → unit progress u along the ray
 * - Depth z shrinks exponentially with u (constant closing-speed toward camera)
 * - Screen placement uses inverse-depth so objects linger far and rush past when near
 * - Scale = apparent / z  (true angular-size growth)
 */
function feedPose(delta: number): {
  leftPct: number
  topPct: number
  opacity: number
  scale: number
  zIndex: number
} {
  let uLin: number
  if (delta >= 0) {
    // Ahead → horizon: delta=+WINDOW → 0, delta=0 → FEED_FOCUS_T
    uLin = ((WINDOW_RADIUS - Math.min(WINDOW_RADIUS, delta)) / WINDOW_RADIUS) * FEED_FOCUS_T
  } else {
    // Past → exit: delta=0 → FEED_FOCUS_T, delta=-WINDOW → 1
    uLin = FEED_FOCUS_T + (Math.min(WINDOW_RADIUS, -delta) / WINDOW_RADIUS) * (1 - FEED_FOCUS_T)
  }
  uLin = Math.min(1, Math.max(0, uLin))

  // Exponential depth: z(u) = zFar * (zNear/zFar)^u  → 1/z blooms late (space approach)
  const z =
    FEED_Z_FAR * Math.pow(FEED_Z_NEAR / FEED_Z_FAR, uLin)
  // Inverse-depth screen fraction — nonlinear track (slow far, accelerate near)
  const invFar = 1 / FEED_Z_FAR
  const invNear = 1 / FEED_Z_NEAR
  const t = Math.min(1, Math.max(0, (1 / z - invFar) / (invNear - invFar)))

  const leftPct = FEED_ORIGIN_X + (FEED_END_X - FEED_ORIGIN_X) * t
  const topPct = FEED_ORIGIN_Y + (FEED_END_Y - FEED_ORIGIN_Y) * t
  const scale = FEED_APPARENT / z
  // Soft fog at horizon; hold readable mid-field; fade only after leaving the frame
  let opacity: number
  if (topPct > 112) opacity = Math.max(0, 1 - (topPct - 112) / 28)
  else if (uLin < FEED_FOCUS_T * 0.55) opacity = 0.08 + (uLin / (FEED_FOCUS_T * 0.55)) * 0.42
  else opacity = Math.min(1, 0.5 + (1 / z) * 0.55)
  const zIndex = Math.max(1, Math.round(1 + (1 / z) * 22))
  return { leftPct, topPct, opacity, scale, zIndex }
}

function CrawlText({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        // Fixed weight forever — never flip bold/semibold on focus (avoids glyph jump)
        'space-y-2 px-1 sm:px-2 text-center font-normal tracking-[0.04em]',
        'text-[color-mix(in_oklch,oklch(0.86_0.14_95)_70%,hsl(var(--foreground)))]',
        'dark:text-[color-mix(in_oklch,oklch(0.9_0.12_95)_55%,hsl(var(--foreground)))]',
        TILE_INK,
        className,
      )}
    >
      {children}
    </div>
  )
}


/** Borderless tile shell — padding only, no focus/past edge. */
function StableJourneyShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-[15px] bg-transparent p-3 sm:p-4">
      <div className="relative min-w-0">{children}</div>
    </div>
  )
}

/** Feature lines on the feed — full text immediately (typing lives in the quest HUD). */
function featureLinesForNode(node: Exclude<JourneyNode, { kind: 'now' }> | JourneyNode): string[] {
  if (node.kind === 'release') {
    const bullets = node.preview.bullets.filter(Boolean)
    if (bullets.length > 0) return bullets.slice(0, 6)
    return [`Release ${node.version}`]
  }
  if (node.kind === 'now') {
    const heading = node.preview.heading
    const bullets = node.preview.bullets.filter(Boolean)
    return [heading, ...bullets].filter((s): s is string => Boolean(s)).slice(0, 6)
  }
  return [node.title, node.summary].filter(Boolean)
}

function FeatureTileBody({ node }: { node: Exclude<JourneyNode, { kind: 'now' }> }) {
  const lines = useMemo(() => featureLinesForNode(node), [node])

  return (
    <CrawlText className="w-full max-w-none text-left">
      <ul className="w-full space-y-1 text-left text-sm leading-snug text-foreground/85 sm:text-[0.95rem]">
        {lines.map((fullLine, i) => (
          <li key={`${node.id}-l${i}`} className="flex w-max max-w-full gap-2">
            <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center">
              <Sparkles
                className={cn('h-3.5 w-3.5 text-[var(--davinci-beam)]', TILE_LINE)}
                aria-hidden
              />
            </span>
            <span className="whitespace-nowrap text-left font-normal">{fullLine}</span>
          </li>
        ))}
      </ul>
    </CrawlText>
  )
}

function JourneyFlowCard({
  node,
  labels,
  locale,
  delta,
}: {
  node: JourneyNode
  labels: RocketJourneyLabels
  locale: Locale
  delta: number
}) {
  // NOW = only tile with filled davinci glass bg (hub CTAs — no changelog button)
  if (node.kind === 'now') {
    const calculatorHref = toAppHref(`${ROUTES.CALCULATOR(locale)}?hosting=ringdom`)
    const title =
      node.preview.heading ?? node.preview.bullets[0] ?? `Current release`
    const bullets =
      node.preview.heading || !node.preview.bullets[0]
        ? node.preview.bullets
        : node.preview.bullets.slice(1)

    return (
      <BorderBeam
        duration="5s"
        disabled={false}
        className={cn(
          davinciGlassSurface,
          'relative rounded-[15px] border-secondary !bg-secondary',
        )}
        innerClassName={cn(
          davinciBeamInnerSurface,
          'relative space-y-3 !bg-secondary/95 p-4 sm:p-5 font-normal',
          TILE_INK,
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <DavinciGlassChip icon={<Rocket className={cn('h-3 w-3', TILE_LINE)} />}>
            {labels.nowLabel}
          </DavinciGlassChip>
          <DavinciGlassChip>v{node.version}</DavinciGlassChip>
          {node.date ? (
            <time dateTime={node.date} className="text-xs tabular-nums text-foreground/75">
              {node.date}
            </time>
          ) : null}
        </div>
        <h3 className={cn('text-xl font-normal tracking-tight text-foreground', TILE_INK)}>
          {title}
        </h3>
        {bullets.length > 0 ? (
          <ul className="space-y-1.5 text-sm text-foreground/85">
            {bullets.map((b) => (
              <li key={b} className="flex gap-2 text-left">
                <Sparkles
                  className={cn(
                    'mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--davinci-beam)]',
                    TILE_LINE,
                  )}
                />
                <span className="font-normal">{b}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-1">
          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(davinciCtaPrimary, 'inline-flex items-center gap-2 px-3 py-2 text-xs')}
          >
            <GithubIcon className={cn('h-3.5 w-3.5', TILE_LINE)} />
            {labels.githubCta}
          </a>
          <Link
            href={calculatorHref}
            className={cn(davinciCtaPrimary, 'inline-flex items-center gap-2 px-3 py-2 text-xs')}
          >
            <Crown className={cn('h-3.5 w-3.5 text-amber-500', TILE_LINE)} />
            {labels.ringdomCta}
          </Link>
        </div>
      </BorderBeam>
    )
  }

  return (
    <StableJourneyShell>
      <FeatureTileBody node={node} />
    </StableJourneyShell>
  )
}


/** Two-line love label — animated DaVinci glass on the letters (no plate). */
function LoveLabel({ active }: { active: boolean }) {
  if (!active) return null

  return (
    <div
      className={cn(
        'davinci-animated-glass-text ring-roadmap-love-label pointer-events-none flex flex-col items-center justify-center',
        'text-center font-normal leading-[1.15] tracking-[0.14em]',
      )}
      style={{ fontSize: 'clamp(0.75rem, 5.2cqw, 2.75rem)' }}
    >
      <p className="m-0 whitespace-nowrap">Love is</p>
      <p className="m-0 whitespace-nowrap">all we need</p>
    </div>
  )
}

/** Quest explorer log — ultra-fast typed feature lines (monospace, no stars). */
type QuestEmit = {
  id: string
  version: string
  date: string
  features: string[]
}

type QuestLogLine = {
  key: string
  full: string
  shown: string
  flash: boolean
}

function JourneyEmitOverlay({
  emit,
  hidden,
  instant = false,
}: {
  emit: QuestEmit | null
  hidden: boolean
  /** Slider / rocket scrub — dump completed lines, no typewriter. */
  instant?: boolean
  layoutKey?: number
}) {
  const [lines, setLines] = useState<QuestLogLine[]>([])
  const [setFlash, setSetFlash] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const queueRef = useRef<{ setId: string; features: string[] }[]>([])
  const seenSetRef = useRef<string | null>(null)
  const busyRef = useRef(false)
  const lineKeyRef = useRef(0)
  const instantRef = useRef(instant)
  instantRef.current = instant

  const flushComplete = useCallback((features: string[]) => {
    if (features.length === 0) return
    setLines((prev) => {
      const added = features.map((full) => ({
        key: `q-${++lineKeyRef.current}`,
        full,
        shown: full,
        flash: false,
      }))
      const next = [...prev, ...added]
      return next.length > 48 ? next.slice(-48) : next
    })
  }, [])

  useEffect(() => {
    if (!emit || hidden || emit.features.length === 0) return
    if (seenSetRef.current === emit.id) return
    seenSetRef.current = emit.id
    if (instantRef.current) {
      flushComplete(emit.features)
      return
    }
    queueRef.current.push({ setId: emit.id, features: [...emit.features] })
  }, [emit, hidden, flushComplete])

  useEffect(() => {
    if (!instant) return
    queueRef.current = []
    setSetFlash(false)
    setLines((prev) =>
      prev.map((l) =>
        l.shown.length < l.full.length ? { ...l, shown: l.full, flash: false } : { ...l, flash: false },
      ),
    )
  }, [instant])

  useEffect(() => {
    if (hidden || instant) return
    let cancelled = false
    const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms))

    const drain = async () => {
      if (busyRef.current || instantRef.current) return
      busyRef.current = true
      try {
        while (!cancelled && !instantRef.current && queueRef.current.length > 0) {
          const job = queueRef.current.shift()!
          for (let fi = 0; fi < job.features.length; fi++) {
            const full = job.features[fi]!
            if (cancelled || instantRef.current) {
              if (instantRef.current) flushComplete(job.features.slice(fi))
              return
            }
            const key = `q-${++lineKeyRef.current}`
            setLines((prev) => {
              const next = [...prev, { key, full, shown: '', flash: false }]
              return next.length > 48 ? next.slice(-48) : next
            })
            for (let c = 1; c <= full.length; c++) {
              if (cancelled || instantRef.current) {
                setLines((prev) =>
                  prev.map((l) => (l.key === key ? { ...l, shown: full, flash: false } : l)),
                )
                if (instantRef.current) flushComplete(job.features.slice(fi + 1))
                return
              }
              const shown = full.slice(0, c)
              setLines((prev) => prev.map((l) => (l.key === key ? { ...l, shown } : l)))
              await sleep(5)
            }
            setLines((prev) => prev.map((l) => (l.key === key ? { ...l, flash: true } : l)))
            await sleep(320)
            if (cancelled || instantRef.current) return
            setLines((prev) => prev.map((l) => (l.key === key ? { ...l, flash: false } : l)))
            await sleep(40)
          }
          if (cancelled || instantRef.current) return
          setSetFlash(true)
          await sleep(380)
          if (cancelled || instantRef.current) return
          setSetFlash(false)
        }
      } finally {
        busyRef.current = false
        if (!cancelled && !instantRef.current && queueRef.current.length > 0) void drain()
      }
    }

    const kick = window.setTimeout(() => {
      void drain()
    }, 0)
    const poll = window.setInterval(() => {
      if (!busyRef.current && !instantRef.current && queueRef.current.length > 0) void drain()
    }, 120)

    return () => {
      cancelled = true
      window.clearTimeout(kick)
      window.clearInterval(poll)
    }
  }, [hidden, emit?.id, instant, flushComplete])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || collapsed) return
    el.scrollTop = el.scrollHeight
  }, [lines, collapsed])

  if (!emit || hidden) return null

  const showVersion = setFlash && !instant && Boolean(emit.version)
  const headerRight = emit.date || '—'

  return (
    <div className="pointer-events-none absolute inset-0 z-[25] overflow-hidden">
      <div
        className={cn(
          'absolute right-3 top-3 z-[3] flex w-[min(46vw,17.5rem)] flex-col sm:right-5 sm:top-4',
          'pointer-events-auto select-none font-mono text-[10px] leading-snug tracking-[0.06em] sm:text-[11px]',
          'text-[color-mix(in_oklch,var(--davinci-beam)_88%,hsl(var(--foreground)))]',
          'border border-[color-mix(in_oklch,var(--davinci-beam)_35%,transparent)]',
          'bg-[color-mix(in_oklch,hsl(var(--background))_58%,transparent)] px-2.5 py-2 backdrop-blur-[2px]',
          showVersion && 'ring-roadmap-quest-set-flash',
        )}
      >
        <button
          type="button"
          className="mb-0 flex w-full items-center gap-2 border-b border-[color-mix(in_oklch,var(--davinci-beam)_22%,transparent)] pb-1.5 text-left"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand quest log' : 'Collapse quest log'}
          onClick={() => setCollapsed((v) => !v)}
        >
          <span
            className={cn(
              'inline-block size-1.5 shrink-0 rounded-full',
              showVersion
                ? 'ring-roadmap-quest-green bg-[oklch(0.72_0.19_145)] shadow-[0_0_8px_oklch(0.72_0.19_145)]'
                : 'ring-roadmap-hud-blink bg-[oklch(0.62_0.22_25)] shadow-[0_0_6px_oklch(0.62_0.22_25)]',
            )}
          />
          <span className="min-w-0 flex-1 truncate text-[9px] tracking-[0.14em] opacity-90">
            {showVersion ? (
              <>
                <span className="text-[oklch(0.78_0.18_145)]">{emit.version}</span>
                <span className="opacity-55"> // </span>
              </>
            ) : null}
            <time dateTime={emit.date || undefined} className="tabular-nums tracking-[0.1em]">
              {headerRight}
            </time>
          </span>
          <span className="shrink-0 text-[9px] opacity-55" aria-hidden>
            {collapsed ? '+' : '−'}
          </span>
        </button>
        {!collapsed ? (
          <div
            ref={scrollRef}
            className="mt-1.5 max-h-[min(42vh,18rem)] min-h-[7.5rem] space-y-1 overflow-y-auto pr-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {lines.length === 0 ? (
              <div className="opacity-45">awaiting telemetry…</div>
            ) : (
              lines.map((line) => (
                <div
                  key={line.key}
                  className={cn(
                    'transition-all duration-150',
                    line.flash && !instant && 'ring-roadmap-quest-line-flash text-[oklch(0.78_0.18_145)]',
                  )}
                >
                  <span className="opacity-45">&gt; </span>
                  <span className="whitespace-pre-wrap break-words">{line.shown}</span>
                  {!instant && line.shown.length < line.full.length ? (
                    <span className="ml-0.5 inline-block h-2.5 w-px animate-pulse bg-[var(--davinci-beam)] align-middle" />
                  ) : null}
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** Past→NOW auto-flight duration at 1× (seconds) — 3× slower for readability. */
const PAST_FLIGHT_DURATION_S = 234
/** NOW→future crawl duration at 1× (seconds). */
const FUTURE_FLIGHT_DURATION_S = 420
const TAP_BOOST_STEP = 1.15
/** After NOW, taps use the same ramp with 4× less efficiency. */
const FUTURE_TAP_BOOST_STEP = TAP_BOOST_STEP / 4
/** Above mobile bottom nav (`z-[9000]`) and avatar widget (`z-[8500]`). */
const ROADMAP_FULLSCREEN_Z = 9200
/** Time for 16× warp lines to grow from vanishing point to widget edges. */
const WARP_GROW_MS = 4200
/** Brief beat after rays fill the frame before the big Ring appears (no separate white overlay). */
const WARP_LOGO_AFTER_RAYS_MS = 220
/** If taps pause longer than this, speed decays toward 1× and hyperspace ends. */
const TAP_IDLE_DECAY_MS = 380
const TAP_DECAY_TICK_MS = 90
const TAP_DECAY_FACTOR = 0.78

type FlightLeg = 'to-now' | 'to-future'

export function RocketJourneyWidget({
  nodes,
  labels,
  locale,
  className,
}: RocketJourneyWidgetProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const ringAnchorRef = useRef<HTMLDivElement>(null)
  const rocketAnchorRef = useRef<HTMLButtonElement>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flightControlsRef = useRef<ReturnType<typeof animate> | null>(null)
  const flightStartedRef = useRef(false)
  const pendingFlightRef = useRef(false)
  const focusRef = useRef(0)
  const flyingRef = useRef(false)
  const speedMultRef = useRef(1)
  const lastTapAtRef = useRef(0)
  const decayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const focusRafRef = useRef(0)
  const flightLegRef = useRef<FlightLeg>('to-now')
  const futureHoldRef = useRef(false)
  const atNowGateRef = useRef(false)

  const [trackHeight, setTrackHeight] = useState(0)
  const [idle, setIdle] = useState(true)
  const [flying, setFlying] = useState(false)
  const [hyperspace, setHyperspace] = useState(false)
  const [dragging, setDragging] = useState(false)
  /** Auto-leg finished at NOW — boost must be held to enter future. */
  const [atNowGate, setAtNowGate] = useState(false)
  const [boostHeld, setBoostHeld] = useState(false)
  const [speedLabel, setSpeedLabel] = useState(1)
  const [fullscreen, setFullscreen] = useState(false)
  const [portalReady, setPortalReady] = useState(false)
  /** 0–1 growth of 16× warp lines toward the widget edges. */
  const [warpProgress, setWarpProgress] = useState(0)
  const [warpLogo, setWarpLogo] = useState(false)
  const [logoPx, setLogoPx] = useState(320)
  const { setTheme, theme, resolvedTheme } = useTheme()
  const [themeMounted, setThemeMounted] = useState(false)

  useEffect(() => {
    setThemeMounted(true)
    setPortalReady(true)
  }, [])

  // Hold 16× → grow warp lines to edges; drop below 16× → reset overlay
  const holdingWarp = speedLabel >= WARP_LINES_SPEED - 0.05
  useEffect(() => {
    if (!holdingWarp) {
      setWarpProgress(0)
      setWarpLogo(false)
      return
    }
    let raf = 0
    let last = performance.now()
    let done = false
    const tick = (now: number) => {
      if (done) return
      const dt = now - last
      last = now
      setWarpProgress((p) => {
        if (p >= 1) {
          done = true
          return 1
        }
        const next = Math.min(1, p + dt / WARP_GROW_MS)
        if (next >= 1) done = true
        return next
      })
      if (!done) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      done = true
      cancelAnimationFrame(raf)
    }
  }, [holdingWarp])

  // Rays fill the frame (= whiteout); ring appears shortly after — no separate white overlay
  useEffect(() => {
    if (warpProgress < 0.995) {
      setWarpLogo(false)
      return
    }
    const logoTimer = window.setTimeout(() => setWarpLogo(true), WARP_LOGO_AFTER_RAYS_MS)
    return () => window.clearTimeout(logoTimer)
  }, [warpProgress])

  // Final ring tracks ~90% of viewport / widget width
  useEffect(() => {
    const sync = () => {
      const el = rootRef.current
      const w = el?.clientWidth || window.innerWidth
      setLogoPx(Math.max(160, Math.round(w * 0.9)))
    }
    sync()
    window.addEventListener('resize', sync)
    const el = rootRef.current
    const ro = el ? new ResizeObserver(sync) : null
    if (el && ro) ro.observe(el)
    return () => {
      window.removeEventListener('resize', sync)
      ro?.disconnect()
    }
  }, [fullscreen, portalReady])

  useEffect(() => {
    if (!fullscreen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [fullscreen])

  const toggleTheme = useCallback(() => {
    toggleThemeWithTransition(setTheme, theme, resolvedTheme)
  }, [resolvedTheme, setTheme, theme])

  const nowIndex = useMemo(() => {
    const idx = nodes.findIndex((n) => n.kind === 'now')
    return idx >= 0 ? idx : Math.max(0, nodes.length - 1)
  }, [nodes])

  const endIndex = Math.max(0, nodes.length - 1)

  const [focus, setFocus] = useState(0)
  const activeIndex = progressToIndex(
    nodes.length <= 1 ? 0 : focus / Math.max(1, nodes.length - 1),
    nodes.length,
  )

  const maxTravel = Math.max(0, trackHeight - ROCKET_SIZE)
  const y = useMotionValue(0)

  const setGate = useCallback((on: boolean) => {
    atNowGateRef.current = on
    setAtNowGate(on)
  }, [])

  const bumpActivity = useCallback(() => {
    setIdle(false)
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => setIdle(true), IDLE_AFTER_MS)
  }, [])

  const clearDecay = useCallback(() => {
    if (decayTimerRef.current) {
      clearInterval(decayTimerRef.current)
      decayTimerRef.current = null
    }
  }, [])

  const syncSpeedUi = useCallback((mult: number) => {
    setHyperspace(mult >= HYPER_SPEED_THRESHOLD)
    setSpeedLabel(Math.round(mult * 10) / 10)
  }, [])

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      if (focusRafRef.current) cancelAnimationFrame(focusRafRef.current)
      clearDecay()
      flightControlsRef.current?.stop()
    }
  }, [clearDecay])

  const measure = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    setTrackHeight(el.clientHeight)
  }, [])

  useEffect(() => {
    measure()
    const el = trackRef.current
    if (!el) return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure, fullscreen])

  // Park at first widget (bottom of track) once measured
  useEffect(() => {
    if (maxTravel <= 0 || nodes.length === 0) return
    if (flightStartedRef.current || flying) return
    const p = indexToProgress(0, nodes.length)
    y.set((1 - p) * maxTravel)
    focusRef.current = 0
    setFocus(0)
  }, [flying, maxTravel, nodes.length, y])

  useMotionValueEvent(y, 'change', () => {
    if (maxTravel <= 0 || nodes.length === 0) return
    const latest = y.get()
    const p = 1 - latest / maxTravel
    focusRef.current = p * Math.max(0, nodes.length - 1)
    // One React focus commit per frame — keeps ultra-speed readable without freeze
    if (!focusRafRef.current) {
      focusRafRef.current = requestAnimationFrame(() => {
        focusRafRef.current = 0
        setFocus(focusRef.current)
      })
    }
  })

  const stopFlight = useCallback(() => {
    flightControlsRef.current?.stop()
    flightControlsRef.current = null
    flyingRef.current = false
    setFlying(false)
  }, [])

  const runFlightTo = useCallback(
    (targetIndex: number, speedMult: number, leg: FlightLeg) => {
      if (nodes.length === 0 || maxTravel <= 0) return
      const from = focusRef.current
      const clampedTarget = Math.min(endIndex, Math.max(0, targetIndex))
      if (from >= clampedTarget - 0.02) {
        stopFlight()
        if (leg === 'to-now') {
          flightLegRef.current = 'to-now'
          setGate(true)
          speedMultRef.current = 1
          syncSpeedUi(1)
          clearDecay()
        }
        return
      }

      const span = Math.max(0.001, clampedTarget - from)
      const base = leg === 'to-now' ? PAST_FLIGHT_DURATION_S : FUTURE_FLIGHT_DURATION_S
      const fullSpan = Math.max(1, leg === 'to-now' ? nowIndex : Math.max(1, endIndex - nowIndex))
      const duration = (base * span) / fullSpan / Math.max(0.15, speedMult)
      const targetY = (1 - indexToProgress(clampedTarget, nodes.length)) * maxTravel

      flightControlsRef.current?.stop()
      flightLegRef.current = leg
      flyingRef.current = true
      setFlying(true)
      bumpActivity()
      flightControlsRef.current = animate(y, targetY, {
        duration: Math.max(0.4, duration),
        ease: 'linear',
        onComplete: () => {
          flyingRef.current = false
          setFlying(false)
          focusRef.current = clampedTarget
          setFocus(clampedTarget)
          if (leg === 'to-now') {
            setGate(true)
            speedMultRef.current = 1
            syncSpeedUi(1)
            clearDecay()
          } else {
            setGate(false)
            futureHoldRef.current = false
            setBoostHeld(false)
          }
        },
      })
    },
    [
      bumpActivity,
      clearDecay,
      endIndex,
      maxTravel,
      nodes.length,
      nowIndex,
      setGate,
      stopFlight,
      syncSpeedUi,
      y,
    ],
  )

  // Remeasure + remap only when fullscreen toggles (not on flight helper identity churn)
  useEffect(() => {
    let cancelled = false
    let outerRaf = 0
    let innerRaf = 0
    outerRaf = requestAnimationFrame(() => {
      measure()
      innerRaf = requestAnimationFrame(() => {
        if (cancelled) return
        const trackH = trackRef.current?.clientHeight ?? 0
        setTrackHeight(trackH)
        const travel = Math.max(0, trackH - ROCKET_SIZE)
        if (nodes.length === 0 || travel <= 0 || !flightStartedRef.current) return

        const wasFlying = flyingRef.current
        const leg = flightLegRef.current
        const mult = Math.max(0.15, speedMultRef.current)
        const from = focusRef.current
        const target = Math.min(
          endIndex,
          Math.max(0, leg === 'to-future' ? endIndex : nowIndex),
        )

        flightControlsRef.current?.stop()
        flightControlsRef.current = null

        const span = Math.max(1, nodes.length - 1)
        const p = from / span
        y.set((1 - p) * travel)

        if (!wasFlying || from >= target - 0.02) {
          flyingRef.current = false
          setFlying(false)
          return
        }

        const remain = Math.max(0.001, target - from)
        const base = leg === 'to-now' ? PAST_FLIGHT_DURATION_S : FUTURE_FLIGHT_DURATION_S
        const fullSpan = Math.max(1, leg === 'to-now' ? nowIndex : Math.max(1, endIndex - nowIndex))
        const duration = (base * remain) / fullSpan / mult
        const targetY = (1 - indexToProgress(target, nodes.length)) * travel

        flyingRef.current = true
        setFlying(true)
        flightLegRef.current = leg
        flightControlsRef.current = animate(y, targetY, {
          duration: Math.max(0.4, duration),
          ease: 'linear',
          onComplete: () => {
            flyingRef.current = false
            setFlying(false)
            focusRef.current = target
            setFocus(target)
            if (leg === 'to-now') {
              setGate(true)
              speedMultRef.current = 1
              syncSpeedUi(1)
              clearDecay()
            } else {
              setGate(false)
              futureHoldRef.current = false
              setBoostHeld(false)
            }
          },
        })
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(outerRaf)
      cancelAnimationFrame(innerRaf)
    }
    // Intentionally fullscreen-only: helpers read from refs / stable values above.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remount layout on fullscreen toggle only
  }, [fullscreen])

  const startDecayLoop = useCallback(() => {
    clearDecay()
    decayTimerRef.current = setInterval(() => {
      if (futureHoldRef.current) return
      if (atNowGateRef.current) return
      if (Date.now() - lastTapAtRef.current < TAP_IDLE_DECAY_MS) return
      const leg = flightLegRef.current
      const target = leg === 'to-future' ? endIndex : nowIndex
      if (speedMultRef.current <= 1.02) {
        speedMultRef.current = 1
        syncSpeedUi(1)
        clearDecay()
        if (flyingRef.current) {
          runFlightTo(target, 1, leg)
        }
        return
      }
      speedMultRef.current = Math.max(1, speedMultRef.current * TAP_DECAY_FACTOR)
      syncSpeedUi(speedMultRef.current)
      if (flyingRef.current) {
        runFlightTo(target, speedMultRef.current, leg)
      }
    }, TAP_DECAY_TICK_MS)
  }, [clearDecay, endIndex, nowIndex, runFlightTo, syncSpeedUi])

  // Viewport enter → auto-flight genesis → NOW (stops at ring)
  useEffect(() => {
    const el = rootRef.current
    if (!el || nodes.length === 0) return

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const kickoff = () => {
      if (flightStartedRef.current) return
      if (maxTravel <= 0) {
        pendingFlightRef.current = true
        return
      }
      flightStartedRef.current = true
      pendingFlightRef.current = false
      if (prefersReduced) {
        const p = indexToProgress(nowIndex, nodes.length)
        y.set((1 - p) * maxTravel)
        focusRef.current = nowIndex
        setFocus(nowIndex)
        setGate(true)
        return
      }
      setGate(false)
      speedMultRef.current = 1
      syncSpeedUi(1)
      runFlightTo(nowIndex, 1, 'to-now')
    }

    if (pendingFlightRef.current && maxTravel > 0) {
      kickoff()
    }

    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.28)
        if (!hit) return
        kickoff()
      },
      { threshold: [0.28, 0.4, 0.55] },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [fullscreen, maxTravel, nodes.length, nowIndex, runFlightTo, setGate, syncSpeedUi, y])

  const snapToIndex = useCallback(
    (index: number) => {
      if (nodes.length === 0 || maxTravel <= 0) return
      stopFlight()
      clearDecay()
      futureHoldRef.current = false
      setBoostHeld(false)
      speedMultRef.current = 1
      syncSpeedUi(1)
      bumpActivity()
      const clamped = Math.min(nodes.length - 1, Math.max(0, index))
      const p = indexToProgress(clamped, nodes.length)
      const targetY = (1 - p) * maxTravel
      animate(y, targetY, { type: 'spring', stiffness: 420, damping: 34 })
      focusRef.current = clamped
      setFocus(clamped)
      flightStartedRef.current = true
      if (Math.abs(clamped - nowIndex) <= 0.02) {
        setGate(true)
        flightLegRef.current = 'to-now'
      } else if (clamped > nowIndex) {
        setGate(false)
        flightLegRef.current = 'to-future'
      } else {
        setGate(false)
        flightLegRef.current = 'to-now'
      }
    },
    [bumpActivity, clearDecay, maxTravel, nodes.length, nowIndex, setGate, stopFlight, syncSpeedUi, y],
  )

  const magnetSnap = useCallback(
    (index: number) => {
      if (Math.abs(index - nowIndex) <= NOW_MAGNET_RADIUS) {
        snapToIndex(nowIndex)
        return
      }
      snapToIndex(index)
    },
    [nowIndex, snapToIndex],
  )

  /** Past taps: full step → NOW. After ring: same ramp at 4× less efficiency → future. */
  const onBoostTap = useCallback(() => {
    bumpActivity()
    const at = focusRef.current
    const inFutureZone = atNowGateRef.current || at >= nowIndex - 0.05

    if (inFutureZone) {
      if (at >= endIndex - 0.02) return
      lastTapAtRef.current = Date.now()
      setGate(false)
      speedMultRef.current = Math.min(
        TAP_BOOST_MAX,
        Math.max(1, speedMultRef.current) + FUTURE_TAP_BOOST_STEP,
      )
      syncSpeedUi(speedMultRef.current)
      runFlightTo(endIndex, speedMultRef.current, 'to-future')
      startDecayLoop()
      return
    }

    if (futureHoldRef.current) return
    if (at >= nowIndex - 0.02) return

    lastTapAtRef.current = Date.now()
    speedMultRef.current = Math.min(TAP_BOOST_MAX, speedMultRef.current + TAP_BOOST_STEP)
    syncSpeedUi(speedMultRef.current)
    if (!flightStartedRef.current) {
      flightStartedRef.current = true
      setGate(false)
    }
    runFlightTo(nowIndex, speedMultRef.current, 'to-now')
    startDecayLoop()
  }, [
    bumpActivity,
    endIndex,
    nowIndex,
    runFlightTo,
    setGate,
    startDecayLoop,
    syncSpeedUi,
  ])

  /** Hold after NOW: keep crawl alive without decay; release resumes tap-decay (does not hard-stop). */
  const onBoostHoldStart = useCallback(() => {
    bumpActivity()
    const at = focusRef.current
    const canEnterFuture = atNowGateRef.current || at >= nowIndex - 0.05
    if (!canEnterFuture) return
    if (at >= endIndex - 0.02) return

    futureHoldRef.current = true
    setBoostHeld(true)
    setGate(false)
    clearDecay()
    if (speedMultRef.current < 1) speedMultRef.current = 1
    syncSpeedUi(speedMultRef.current)
    runFlightTo(endIndex, speedMultRef.current, 'to-future')
  }, [bumpActivity, clearDecay, endIndex, nowIndex, runFlightTo, setGate, syncSpeedUi])

  const onBoostHoldEnd = useCallback(() => {
    if (!futureHoldRef.current) return
    futureHoldRef.current = false
    setBoostHeld(false)
    // Resume decay toward 1× but keep flying — taps can re-boost
    if (focusRef.current < endIndex - 0.02) {
      flightLegRef.current = 'to-future'
      startDecayLoop()
      if (flyingRef.current) {
        runFlightTo(endIndex, Math.max(1, speedMultRef.current), 'to-future')
      }
    }
  }, [endIndex, runFlightTo, startDecayLoop])

  // Ensure future-hold ends even if pointer is released outside the button
  useEffect(() => {
    if (!boostHeld) return
    const end = () => onBoostHoldEnd()
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    window.addEventListener('blur', end)
    return () => {
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      window.removeEventListener('blur', end)
    }
  }, [boostHeld, onBoostHoldEnd])

  const onBoostPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault()
      const enterFuture =
        atNowGateRef.current || focusRef.current >= nowIndex - 0.05
      if (enterFuture) {
        e.currentTarget.setPointerCapture(e.pointerId)
        // Tap boost (/4) + hold suppresses decay while pressed
        onBoostTap()
        onBoostHoldStart()
        return
      }
      onBoostTap()
    },
    [nowIndex, onBoostHoldStart, onBoostTap],
  )

  const onBoostPointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      onBoostHoldEnd()
    },
    [onBoostHoldEnd],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      bumpActivity()
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        stopFlight()
        magnetSnap(activeIndex + 1)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        stopFlight()
        magnetSnap(activeIndex - 1)
      } else if (e.key === 'Home') {
        e.preventDefault()
        snapToIndex(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        snapToIndex(nodes.length - 1)
      }
    },
    [activeIndex, bumpActivity, magnetSnap, nodes.length, snapToIndex, stopFlight],
  )

  const visibleIndexes = useMemo(() => {
    if (nodes.length === 0) return []
    const set = new Set<number>()
    const lo = Math.floor(focus) - WINDOW_RADIUS
    const hi = Math.ceil(focus) + WINDOW_RADIUS
    for (let i = lo; i <= hi; i++) {
      if (i >= 0 && i < nodes.length) set.add(i)
    }
    return Array.from(set).sort((a, b) => b - a)
  }, [focus, nodes.length])

  const trailHeight = useTransform(y, (v) => Math.max(0, maxTravel - v + ROCKET_SIZE / 2))
  const activeNode = nodes[activeIndex]
  const atWarpSpeed = speedLabel >= WARP_LINES_SPEED - 0.05

  /** Quest HUD payload (date + feature lines) + rocket-under version plate label. */
  const emitMeta = useMemo(() => {
    if (!activeNode) return null
    const features = featureLinesForNode(activeNode)
    if (activeNode.kind === 'release' || activeNode.kind === 'now') {
      return {
        id: activeNode.id,
        version: `v${activeNode.version}`,
        date: activeNode.date ?? '',
        features,
      }
    }
    return {
      id: activeNode.id,
      version:
        activeNode.status === 'planned' ? labels.plannedBadge : labels.inProgressBadge,
      date: activeNode.period,
      features,
    }
  }, [activeNode, labels.inProgressBadge, labels.plannedBadge])

  const nowCenterTop =
    maxTravel > 0
      ? (1 - indexToProgress(nowIndex, nodes.length)) * maxTravel + ROCKET_SIZE / 2
      : null

  // Re-measure emit anchors when focus / layout shifts
  const [emitLayoutTick, setEmitLayoutTick] = useState(0)
  useLayoutEffect(() => {
    setEmitLayoutTick((n) => n + 1)
  }, [emitMeta?.id, fullscreen, trackHeight, nowCenterTop])

  const showBeams = flying && !dragging
  const boostAria = atNowGate
    ? 'Hold or tap boost to travel into the future roadmap'
    : boostHeld
      ? 'Release to let speed decay — flight continues'
      : 'Tap rapidly to boost — stop tapping to slow down'

  if (nodes.length === 0) {
    return (
      <div
        className={cn(
          'flex h-[80dvh] items-center justify-center rounded-[15px] border border-border lg:h-[100dvh]',
          className,
        )}
      >
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      </div>
    )
  }

  const widget = (
    <div
      ref={rootRef}
      role={fullscreen ? 'dialog' : undefined}
      aria-modal={fullscreen ? true : undefined}
      aria-label={fullscreen ? 'Roadmap journey fullscreen' : undefined}
      className={cn(
        'relative grid min-w-0 grid-cols-[20%_minmax(0,1fr)] grid-rows-1 border border-border bg-[color-mix(in_oklch,var(--davinci-glass-bg)_55%,hsl(var(--background)))]',
        // Fly-through ring+letters must paint past the frame
        warpLogo ? 'z-[70] overflow-visible' : 'overflow-hidden',
        fullscreen
          ? 'h-[100dvh] w-[100vw] max-w-none rounded-none border-0'
          : 'h-[80dvh] w-full rounded-[15px] lg:h-[100dvh]',
        className,
      )}
    >
      <WidgetStarfield boostSpeed={speedLabel} warpProgress={warpProgress} />

      <JourneyEmitOverlay
        emit={emitMeta}
        hidden={atWarpSpeed || warpProgress > 0.85}
        instant={dragging || boostHeld}
        layoutKey={emitLayoutTick}
      />

      {/* Tile object feed — VP → 10% lower-right, magnifies on approach */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 z-[1] overflow-hidden',
          warpProgress > 0.92 && 'opacity-0 transition-opacity duration-200',
        )}
      >
        {visibleIndexes.map((i) => {
          const node = nodes[i]!
          const delta = i - focus
          const pose = feedPose(delta)
          const isActive = Math.abs(delta) < 0.5
          return (
            <motion.div
              key={node.id}
              className="pointer-events-auto absolute w-[min(88vw,54rem)] will-change-transform"
              initial={false}
              animate={{
                left: `${pose.leftPct}%`,
                top: `${pose.topPct}%`,
                x: '-50%',
                y: '-50%',
                opacity: pose.opacity,
                scale: pose.scale,
                zIndex: isActive ? 28 : pose.zIndex,
              }}
              transition={{ duration: 0.12, ease: 'linear' }}
              style={{ transformOrigin: '50% 50%' }}
            >
              <JourneyFlowCard
                node={node}
                labels={labels}
                locale={locale}
                delta={delta}
              />
            </motion.div>
          )
        })}
      </div>

      {/* Soft veil only at the last moment — full white comes from growing warp rays */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[30] bg-white"
        style={{
          opacity: warpProgress > 0.94 ? Math.min(0.28, (warpProgress - 0.94) * 4.5) : 0,
          transition: 'opacity 80ms linear',
        }}
      />
      {warpLogo ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute z-[55] [container-type:inline-size]"
          style={{
            left: `${STAR_ORIGIN_X}%`,
            top: `${STAR_ORIGIN_Y}%`,
            width: logoPx,
            height: logoPx,
          }}
          initial={{ opacity: 0, scale: 0.04, x: '-50%', y: '-50%' }}
          animate={{
            // Straight even grow — tiny → past the frame (no keyframe leaps)
            opacity: 1,
            scale: 12,
            x: '-50%',
            y: '-50%',
          }}
          transition={{
            opacity: { duration: 0.4, ease: 'linear' },
            scale: { duration: 4.8, ease: 'linear' },
          }}
        >
          <div className="relative flex size-full items-center justify-center">
            <AnimatedLogo
              size={logoPx}
              vibrant
              className="ring-roadmap-logo-swirl flex size-full max-h-full max-w-full items-center justify-center"
            />
            <div className="pointer-events-none absolute inset-[16%] z-[1] flex items-center justify-center">
              <LoveLabel active={holdingWarp && warpLogo} />
            </div>
          </div>
        </motion.div>
      ) : null}

      {/* Rocket rail — transparent, no separator, above whiteout */}
      <div className="relative z-40 col-start-1 row-start-1 flex flex-col items-center bg-transparent px-1 py-4 sm:px-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          aria-pressed={fullscreen}
          className="mb-2 size-10 shrink-0 rounded-[99px] bg-background/80 backdrop-blur-sm"
          onClick={() => setFullscreen((v) => !v)}
        >
          {fullscreen ? (
            <Minimize2 className="h-4 w-4" aria-hidden />
          ) : (
            <Maximize2 className="h-4 w-4" aria-hidden />
          )}
        </Button>
        <div ref={trackRef} className="relative min-h-0 w-full flex-1">
          <div
            aria-hidden
            className="absolute left-1/2 top-0 h-full w-1 -translate-x-1/2 rounded-full bg-border/50"
          />
          <motion.div
            aria-hidden
            className="absolute left-1/2 bottom-0 w-1 -translate-x-1/2 rounded-full bg-[var(--davinci-beam)]/70"
            style={{ height: trailHeight }}
          />

          <div
            ref={ringAnchorRef}
            aria-hidden
            className={cn(
              'pointer-events-none absolute left-1/2 z-[5] flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center',
              atWarpSpeed && 'opacity-0',
            )}
            style={{ top: nowCenterTop ?? '50%' }}
          >
            <AnimatedLogo
              size={LOGO_SIZE}
              className="pointer-events-none flex size-14 items-center justify-center opacity-90"
            />
          </div>

          <motion.button
            ref={rocketAnchorRef}
            type="button"
            drag="y"
            dragConstraints={{ top: 0, bottom: maxTravel }}
            dragElastic={0.05}
            dragMomentum={false}
            style={{ y }}
            animate={
              showBeams
                ? {
                    x: hyperspace ? [-3, 3, -2, 2, 0] : [-2, 2, -1, 1, 0],
                    rotate: hyperspace ? [-2.5, 2.5, -1.5, 1.5, 0] : [-1.2, 1.2, -0.8, 0.8, 0],
                  }
                : { x: 0, rotate: 0 }
            }
            transition={
              showBeams
                ? {
                    duration: hyperspace ? 0.18 : 0.32,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }
                : { duration: 0.2 }
            }
            onDragStart={() => {
              stopFlight()
              clearDecay()
              futureHoldRef.current = false
              setBoostHeld(false)
              speedMultRef.current = 1
              syncSpeedUi(1)
              setDragging(true)
              bumpActivity()
            }}
            onDrag={() => bumpActivity()}
            onDragEnd={() => {
              setDragging(false)
              bumpActivity()
              magnetSnap(activeIndex)
            }}
            onKeyDown={onKeyDown}
            className={cn(
              'absolute left-1/2 top-0 z-10 flex size-[70px] -translate-x-1/2 cursor-grab items-center justify-center rounded-[99px]',
              'border border-[color-mix(in_oklch,var(--davinci-beam)_40%,transparent)]',
              'bg-[color-mix(in_oklch,var(--davinci-beam)_18%,hsl(var(--background)))] text-[var(--davinci-beam)]',
              'shadow-md active:cursor-grabbing touch-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--davinci-beam)]',
            )}
            role="slider"
            aria-orientation="vertical"
            aria-valuemin={0}
            aria-valuemax={Math.max(0, nodes.length - 1)}
            aria-valuenow={activeIndex}
            aria-valuetext={activeNode ? nodeAriaText(activeNode, labels) : undefined}
            aria-label={labels.dragHint}
          >
            <Rocket className="h-9 w-9 -rotate-45" strokeWidth={2} aria-hidden />
            <IonicBeams active={showBeams} boost={hyperspace} />
          </motion.button>

          {/* Single version plate under the rocket — label tracks focus */}
          {emitMeta?.version && !atWarpSpeed && warpProgress < 0.85 ? (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute left-1/2 z-[9] -translate-x-1/2"
              style={{ y, top: ROCKET_SIZE + 6 }}
            >
              <BorderBeam
                duration="4.5s"
                className={cn(
                  davinciGlassSurface,
                  'rounded-[10px] border border-[color-mix(in_oklch,var(--davinci-beam)_40%,var(--davinci-glass-border))]',
                )}
                innerClassName={cn(
                  davinciBeamInnerSurface,
                  'relative px-2 py-0.5 !bg-secondary/90 font-mono text-[10px] font-normal tabular-nums tracking-tight text-[var(--davinci-beam)] sm:text-[11px]',
                )}
              >
                <span className="block whitespace-nowrap leading-none">{emitMeta.version}</span>
              </BorderBeam>
            </motion.div>
          ) : null}
        </div>

        <div className="mt-2 flex w-full flex-col items-center gap-1 px-0.5">
          <button
            type="button"
            aria-label={boostAria}
            aria-pressed={boostHeld || hyperspace}
            disabled={focus >= endIndex - 0.02}
            className={cn(
              'flex size-11 touch-none select-none items-center justify-center rounded-[99px] transition-transform',
              'border border-[color-mix(in_oklch,var(--davinci-beam)_45%,transparent)]',
              'bg-[color-mix(in_oklch,var(--davinci-beam)_22%,hsl(var(--background)))] text-[var(--davinci-beam)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--davinci-beam)]',
              'disabled:cursor-default disabled:opacity-40',
              hyperspace && 'scale-110 shadow-[0_0_18px_color-mix(in_oklch,var(--davinci-beam)_55%,transparent)]',
              boostHeld && 'scale-105',
              atNowGate && !boostHeld && 'animate-pulse',
            )}
            onPointerDown={onBoostPointerDown}
            onPointerUp={onBoostPointerUp}
            onPointerCancel={onBoostPointerUp}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return
              e.preventDefault()
              if (e.repeat) return
              if (atNowGateRef.current || focusRef.current >= nowIndex - 0.05) {
                onBoostHoldStart()
              } else {
                onBoostTap()
              }
            }}
            onKeyUp={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return
              e.preventDefault()
              onBoostHoldEnd()
            }}
            onBlur={onBoostHoldEnd}
          >
            <Zap
              className={cn('h-5 w-5', hyperspace && 'fill-current')}
              strokeWidth={2.25}
              aria-hidden
            />
          </button>
          <span className="text-center text-[9px] tabular-nums text-muted-foreground sm:text-[10px]">
            {atNowGate
              ? 'hold / tap → future'
              : hyperspace
                ? `boost ×${speedLabel}`
                : speedLabel > 1.05
                  ? `×${speedLabel}`
                  : 'boost'}
          </span>
        </div>
      </div>

      {fullscreen ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="absolute bottom-5 right-5 z-50 size-12 rounded-[99px] border-2 bg-background/90 shadow-lg"
        >
          {!themeMounted ? (
            <Sun className="h-5 w-5" aria-hidden />
          ) : resolvedTheme === 'dark' ? (
            <Moon className="h-5 w-5" aria-hidden />
          ) : (
            <Sun className="h-5 w-5" aria-hidden />
          )}
        </Button>
      ) : null}
    </div>
  )

  if (fullscreen && portalReady) {
    return (
      <>
        {/* Preserve in-flow height so the page does not jump */}
        <div
          aria-hidden
          className={cn('invisible h-[80dvh] w-full lg:h-[100dvh]', className)}
        />
        {createPortal(
          <div
            className="fixed inset-0 bg-background"
            style={{ zIndex: ROADMAP_FULLSCREEN_Z }}
          >
            {widget}
          </div>,
          document.body,
        )}
      </>
    )
  }

  return widget
}
