'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Pause, Play } from 'lucide-react'
import {
  MATCHER_ACTORS,
  MATCHER_MAX_CONCURRENT,
  MATCHER_SPAWN_MAX_MS,
  MATCHER_SPAWN_MIN_MS,
  createMatchEvent,
  getMatchEventSnapshot,
  getOfferType,
  matcherOrchestrationCopy,
  polarPoint,
  type MatchEventSnapshot,
} from '@/lib/ring-widgets/matcher-orchestration'
import {
  approximateQuadLength,
  buildMatchWirePaths,
  outwardFromCenter,
  pointOnMorphPath,
  pointOnQuad,
  quadPathD,
  tangentAngleOnQuad,
  type QuadPath,
} from '@/lib/ring-widgets/matcher-wire-paths'
import type { Locale } from '@/i18n/shared'

const CX = 50
const CY = 50
const RADIUS = 36
const CENTER = { x: CX, y: CY }

export interface RingMatcherOrchestrationProps {
  title?: string
  subtitle?: string
  locale?: Locale
  autoPlay?: boolean
}

function easeSmooth(t: number) {
  return t * t * (3 - 2 * t)
}

function initiatorLabel(snapshot: MatchEventSnapshot, locale: Locale): string {
  const t = matcherOrchestrationCopy[locale] ?? matcherOrchestrationCopy.en
  const requestor = MATCHER_ACTORS[snapshot.event.requestorIdx]
  const offerLabel = getOfferType(requestor.offerId).label[locale]

  switch (snapshot.phase) {
    case 'request':
      return `${t.eventRequest} · ${offerLabel}`
    case 'fanOut':
      return `${t.eventMatch} · ${offerLabel}`
    case 'straighten':
      return t.eventMatch
    case 'chat':
      return t.eventMessage
    default:
      return offerLabel
  }
}

function InitiatorEventLabel({
  x,
  y,
  text,
}: {
  x: number
  y: number
  text: string
}) {
  const padX = 1.4
  const height = 3.4
  const width = Math.min(28, text.length * 1.15 + padX * 2)

  return (
    <g transform={`translate(${x} ${y})`} className="pointer-events-none">
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        rx={height / 2}
        className="fill-background/95 stroke-border"
        strokeWidth="0.22"
      />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="2.15"
        className="fill-foreground font-semibold"
      >
        {text}
      </text>
    </g>
  )
}

function FlyingEmoji({ x, y, color, emoji }: { x: number; y: number; color: string; emoji: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="3.2" fill="var(--background)" stroke={color} strokeWidth="0.35" opacity="0.95" />
      <text textAnchor="middle" dominantBaseline="central" fontSize="3.8">
        {emoji}
      </text>
    </g>
  )
}

function NotificationBulb({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle
        r="4.2"
        fill="var(--background)"
        stroke="#eab308"
        strokeWidth="0.45"
        filter="url(#matcher-bulb-glow)"
        opacity="0.98"
      />
      <text textAnchor="middle" dominantBaseline="central" fontSize="4.2">
        💡
      </text>
    </g>
  )
}

function ChatBubble({ x, y, primary }: { x: number; y: number; primary?: boolean }) {
  const r = 2.75
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle
        r={r}
        className={primary ? 'fill-primary' : 'fill-muted'}
        stroke="var(--border)"
        strokeWidth="0.2"
      />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="2.6"
        className={primary ? 'fill-primary-foreground' : 'fill-foreground'}
        aria-hidden
      >
        💬
      </text>
    </g>
  )
}

const ANT_TRAIL = '#52525b'
const ANT_BODY = '#3f3f46'
const ANT_LEGS = '#71717a'
const ANT_COUNT = 5

function AntGlyph({
  x,
  y,
  angle,
  opacity = 0.9,
}: {
  x: number
  y: number
  angle: number
  opacity?: number
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`} opacity={opacity}>
      <ellipse cx="0" cy="0" rx="0.75" ry="0.42" fill={ANT_BODY} />
      <circle cx="0.95" cy="0" r="0.32" fill={ANT_BODY} />
      <line x1="-0.35" y1="0.28" x2="-0.7" y2="0.55" stroke={ANT_LEGS} strokeWidth="0.14" />
      <line x1="0.1" y1="0.32" x2="0.05" y2="0.62" stroke={ANT_LEGS} strokeWidth="0.14" />
      <line x1="0.45" y1="0.28" x2="0.7" y2="0.55" stroke={ANT_LEGS} strokeWidth="0.14" />
    </g>
  )
}

function AntWirePath({
  path,
  opacity,
  dashProgress,
  length,
  now,
  seed,
  animate = true,
}: {
  path: QuadPath
  opacity: number
  dashProgress?: number
  length: number
  now: number
  seed: number
  animate?: boolean
}) {
  const d = quadPathD(path)
  const reveal = dashProgress ?? 1
  const marchBase = animate ? (now * 0.00022 + seed) % 1 : 0

  return (
    <g className="matcher-ant-wire" opacity={opacity}>
      {/* bleak pheromone trail — always show full curve */}
      <path
        d={d}
        fill="none"
        stroke={ANT_TRAIL}
        strokeWidth="0.42"
        strokeLinecap="round"
        strokeDasharray="0.55 0.95"
        opacity={0.42}
        vectorEffect="non-scaling-stroke"
      />
      {/* active segment being laid */}
      <path
        d={d}
        fill="none"
        stroke={ANT_TRAIL}
        strokeWidth="0.52"
        strokeLinecap="round"
        strokeDasharray={`${length * reveal} ${length}`}
        opacity={0.72}
        vectorEffect="non-scaling-stroke"
      />
      {/* marching bleak ants */}
      {Array.from({ length: ANT_COUNT }, (_, i) => {
        const spacing = 1 / ANT_COUNT
        const rawT = (marchBase + i * spacing) % 1
        const t = dashProgress !== undefined ? Math.min(rawT, reveal) : rawT
        if (dashProgress !== undefined && t >= reveal - 0.02) return null
        const point = pointOnQuad(path, t)
        const angle = tangentAngleOnQuad(path, t)
        const antOpacity = 0.55 + ((i % 3) + 1) * 0.12
        return (
          <AntGlyph
            key={`${seed}-${i}`}
            x={point.x}
            y={point.y}
            angle={angle}
            opacity={antOpacity}
          />
        )
      })}
    </g>
  )
}

function AntMorphWirePath({
  leg1,
  leg2,
  direct,
  morph,
  opacity,
  now,
  seed,
  animate = true,
}: {
  leg1: QuadPath
  leg2: QuadPath
  direct: QuadPath
  morph: number
  opacity: number
  now: number
  seed: number
  animate?: boolean
}) {
  const d = quadPathD(direct)
  const marchBase = animate ? (now * 0.0002 + seed) % 1 : 0

  return (
    <g className="matcher-ant-wire-morph" opacity={opacity}>
      <path
        d={d}
        fill="none"
        stroke={ANT_TRAIL}
        strokeWidth="0.42"
        strokeLinecap="round"
        strokeDasharray="0.55 0.95"
        opacity={0.45}
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={d}
        fill="none"
        stroke={ANT_TRAIL}
        strokeWidth="0.55"
        strokeLinecap="round"
        opacity={0.78}
        vectorEffect="non-scaling-stroke"
      />
      {Array.from({ length: ANT_COUNT + 1 }, (_, i) => {
        const spacing = 1 / (ANT_COUNT + 1)
        const t = (marchBase + i * spacing) % 1
        const point = pointOnMorphPath(leg1, leg2, direct, morph, t)
        const ahead = pointOnMorphPath(leg1, leg2, direct, morph, Math.min(1, t + 0.02))
        const angle = (Math.atan2(ahead.y - point.y, ahead.x - point.x) * 180) / Math.PI
        return (
          <AntGlyph
            key={`morph-${seed}-${i}`}
            x={point.x}
            y={point.y}
            angle={angle}
            opacity={0.6 + (i % 2) * 0.15}
          />
        )
      })}
    </g>
  )
}

function UserNode({
  x,
  y,
  name,
  color,
  active,
}: {
  x: number
  y: number
  name: string
  color: string
  active: boolean
}) {
  const r = active ? 5.2 : 4.6
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={r}
        fill={color}
        fillOpacity={active ? 0.22 : 0.12}
        stroke={color}
        strokeWidth={active ? 0.55 : 0.35}
      />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="3.2"
        className="select-none"
      >
        👤
      </text>
      <text
        x={x}
        y={y + 8.5}
        textAnchor="middle"
        className="fill-foreground text-[2.8px] font-medium"
      >
        {name}
      </text>
    </g>
  )
}

function renderMatchGraphics(
  snapshot: MatchEventSnapshot,
  positions: { x: number; y: number }[],
  now: number,
  reduced: boolean,
  locale: Locale,
) {
  const { event, phase, progress } = snapshot
  const eased = phase === 'straighten' ? easeSmooth(progress) : progress
  const requestPos = positions[event.requestorIdx]
  const providerPos = positions[event.providerIdx]
  const requestor = MATCHER_ACTORS[event.requestorIdx]
  const requestOffer = getOfferType(requestor.offerId)

  const { leg1, leg2, direct } = buildMatchWirePaths(
    requestPos,
    providerPos,
    positions,
    event.requestorIdx,
    event.providerIdx,
  )

  const leg1Len = approximateQuadLength(leg1)
  const leg2Len = approximateQuadLength(leg2)
  const directLen = approximateQuadLength(direct)

  const morph = phase === 'straighten' ? eased : phase === 'chat' ? 1 : 0
  const jointAlpha =
    phase === 'request' || phase === 'fanOut'
      ? 0.85
      : phase === 'straighten'
        ? 0.85 * (1 - eased)
        : 0
  const directAlpha = phase === 'straighten' ? 0.92 * eased : phase === 'chat' ? 0.9 : 0

  const leg1Dash = phase === 'request' ? eased : undefined
  const leg2Dash = phase === 'fanOut' ? eased : undefined

  const requestGlyphPos =
    phase === 'request' ? pointOnQuad(leg1, eased) : phase === 'fanOut' ? CENTER : requestPos

  const bulbPos = phase === 'fanOut' ? pointOnQuad(leg2, eased) : providerPos

  const chatOsc = phase === 'chat' ? ((now - event.startedAt) * 0.0012) % 1 : 0
  const bubbleForward = pointOnMorphPath(leg1, leg2, direct, morph, chatOsc)
  const bubbleBack = pointOnMorphPath(leg1, leg2, direct, morph, 1 - chatOsc)

  const antSeed = event.id.length * 0.17 + event.requestorIdx * 0.31
  const motionOn = !reduced
  const labelOffset = 6.8 + (event.id.charCodeAt(0) % 4) * 0.6
  const labelPos = outwardFromCenter(requestPos, CENTER, labelOffset)

  return (
    <g key={event.id} opacity={phase === 'chat' ? 0.72 + progress * 0.18 : 0.88}>

      {jointAlpha > 0.02 ? (
        <AntWirePath
          path={leg1}
          opacity={jointAlpha}
          dashProgress={leg1Dash}
          length={leg1Len}
          now={now}
          seed={antSeed}
          animate={motionOn}
        />
      ) : null}

      {(phase === 'fanOut' || phase === 'straighten') && jointAlpha > 0.02 ? (
        <AntWirePath
          path={leg2}
          opacity={jointAlpha}
          dashProgress={leg2Dash}
          length={leg2Len}
          now={now}
          seed={antSeed + 1.7}
          animate={motionOn}
        />
      ) : null}

      {directAlpha > 0.02 ? (
        <AntMorphWirePath
          leg1={leg1}
          leg2={leg2}
          direct={direct}
          morph={morph}
          opacity={directAlpha}
          now={now}
          seed={antSeed + 3.1}
          animate={motionOn}
        />
      ) : null}

      {phase === 'request' && (
        <FlyingEmoji
          x={requestGlyphPos.x}
          y={requestGlyphPos.y}
          color={requestOffer.color}
          emoji={requestOffer.emoji}
        />
      )}

      {phase === 'fanOut' && <NotificationBulb x={bulbPos.x} y={bulbPos.y} />}

      {phase === 'chat' && !reduced && (
        <>
          <ChatBubble x={bubbleForward.x} y={bubbleForward.y} primary />
          <ChatBubble x={bubbleBack.x} y={bubbleBack.y} />
        </>
      )}

      <InitiatorEventLabel x={labelPos.x} y={labelPos.y} text={initiatorLabel(snapshot, locale)} />
    </g>
  )
}

export function RingMatcherOrchestration({
  title,
  subtitle,
  locale = 'en',
  autoPlay = true,
}: RingMatcherOrchestrationProps) {
  const reduced = useReducedMotion()
  const t = matcherOrchestrationCopy[locale] ?? matcherOrchestrationCopy.en
  const [playing, setPlaying] = useState(autoPlay)
  const [now, setNow] = useState(0)
  const eventsRef = useRef<ReturnType<typeof createMatchEvent>[]>([])
  const [, bump] = useState(0)
  const spawnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const positions = useMemo(
    () => MATCHER_ACTORS.map((a) => polarPoint(CX, CY, RADIUS, a.angle)),
    [],
  )

  const scheduleSpawn = useCallback(() => {
    if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current)
    if (!playing || reduced) return

    const delay =
      MATCHER_SPAWN_MIN_MS + Math.random() * (MATCHER_SPAWN_MAX_MS - MATCHER_SPAWN_MIN_MS)

    spawnTimerRef.current = setTimeout(() => {
      const ts = performance.now()
      if (eventsRef.current.length < MATCHER_MAX_CONCURRENT) {
        eventsRef.current = [...eventsRef.current, createMatchEvent(MATCHER_ACTORS.length, ts)]
        bump((n) => n + 1)
      }
      scheduleSpawn()
    }, delay)
  }, [playing, reduced])

  useEffect(() => {
    if (!playing || reduced) {
      if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current)
      return
    }

    eventsRef.current = [createMatchEvent(MATCHER_ACTORS.length, performance.now())]
    bump((n) => n + 1)
    scheduleSpawn()

    let frame = 0
    const loop = (ts: number) => {
      if (document.visibilityState === 'visible') {
        setNow(ts)
        const before = eventsRef.current.length
        eventsRef.current = eventsRef.current.filter(
          (event) => getMatchEventSnapshot(event, ts) !== null,
        )
        if (eventsRef.current.length !== before) bump((n) => n + 1)
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frame)
      if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current)
    }
  }, [playing, reduced, scheduleSpawn])

  const activeSnapshots = eventsRef.current
    .map((event) => getMatchEventSnapshot(event, now))
    .filter((s): s is MatchEventSnapshot => s !== null)

  const activeActorIndices = new Set<number>()
  for (const snap of activeSnapshots) {
    activeActorIndices.add(snap.event.requestorIdx)
    activeActorIndices.add(snap.event.providerIdx)
  }

  const matcherPulse = activeSnapshots.some(
    (s) => s.phase === 'request' || s.phase === 'fanOut',
  )

  const activeEventSummary =
    activeSnapshots.length > 0
      ? activeSnapshots.map((s) => initiatorLabel(s, locale)).join('; ')
      : t.matcherLabel

  return (
    <figure className="ring-widget-matcher-orchestration my-8 w-full" data-locale={locale}>
      <figcaption className="mb-4 text-center">
        <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          {title ?? t.title}
        </h2>
        {(subtitle ?? t.subtitle) ? (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle ?? t.subtitle}</p>
        ) : null}
      </figcaption>

      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-muted/30 to-card shadow-sm">
        <div className="absolute right-3 top-3 z-10">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm hover:bg-muted/60"
            aria-pressed={playing}
          >
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            {playing ? t.pause : t.play}
          </button>
        </div>

        <div className="px-3 pb-3 pt-10 sm:px-4">
          <svg
            viewBox="0 0 100 100"
            className="mx-auto aspect-square h-auto w-full max-w-sm [contain:layout_paint]"
            role="img"
            aria-label={activeEventSummary}
          >
            <defs>
              <filter id="matcher-bulb-glow" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="1.1" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {activeSnapshots.map((snapshot) =>
              renderMatchGraphics(snapshot, positions, now, !!reduced, locale),
            )}

            <motion.g
              animate={{
                scale: matcherPulse && !reduced ? [1, 1.05, 1] : 1,
              }}
              transition={{
                duration: 0.55,
                repeat: matcherPulse && !reduced ? Infinity : 0,
                repeatDelay: 0.1,
              }}
            >
              <circle
                cx={CENTER.x}
                cy={CENTER.y}
                r="7.5"
                className="fill-primary/15 stroke-primary/50"
                strokeWidth="0.4"
              />
              <text
                x={CENTER.x}
                y={CENTER.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="5"
                aria-hidden
              >
                🧠
              </text>
              <text
                x={CENTER.x}
                y={CENTER.y + 11}
                textAnchor="middle"
                className="fill-muted-foreground text-[2.8px] font-semibold sm:text-[3px]"
              >
                {t.matcherLabel}
              </text>
            </motion.g>

            {MATCHER_ACTORS.map((actor, index) => {
              const pos = positions[index]
              return (
                <UserNode
                  key={actor.id}
                  x={pos.x}
                  y={pos.y}
                  name={actor.name}
                  color={actor.color}
                  active={activeActorIndices.has(index)}
                />
              )
            })}
          </svg>

          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            {MATCHER_ACTORS.map((actor) => {
              const offer = getOfferType(actor.offerId)
              const Icon = offer.icon
              return (
                <span
                  key={actor.id}
                  className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-muted/20 px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  <Icon className="size-3" style={{ color: offer.color }} aria-hidden />
                  {offer.label[locale]}
                </span>
              )
            })}
          </div>
        </div>
      </div>
    </figure>
  )
}
