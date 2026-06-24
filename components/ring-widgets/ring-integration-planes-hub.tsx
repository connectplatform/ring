/**
 * Ring Integration Planes Hub Component
 *
 * Displays a hub of integration planes with a center orb and planes in a 3×3 orbit.
 * Used in integration hub pages.
 *
 * @author LegioX Commander
 * @version 1.0.0
 */

'use client'

import React, { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowDown,
  Bell,
  CreditCard,
  Layers,
  Mail,
  Plug,
  Shield,
  type LucideIcon,
} from 'lucide-react'
import { useLocale } from 'next-intl'
import { cn } from '@/lib/utils'
import {
  getIntegrationHubCopy,
  planeTone,
  type IntegrationPlane,
  type IntegrationPlaneId,
  type IntegrationPlanesTheme,
} from '@/lib/ring-widgets/integration-planes'
import type { Locale } from '@/i18n/shared'

const planeIcons: Record<IntegrationPlaneId, LucideIcon> = {
  identity: Shield,
  payments: CreditCard,
  comms: Bell,
  mail: Mail,
  external: Plug,
}

export interface RingIntegrationPlanesHubProps {
  locale?: Locale
  theme?: IntegrationPlanesTheme
  title?: string
  subtitle?: string
}

function HubConnector({ reduced, uid }: { reduced: boolean; uid: string }) {
  return (
    <div className="flex flex-col items-center py-1" aria-hidden>
      <div className="relative h-8 w-px overflow-hidden rounded-full bg-border">
        {!reduced ? (
          <motion.span
            className="absolute left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-primary"
            animate={{ top: ['0%', '100%'] }}
            transition={{ duration: 1.4, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
          />
        ) : null}
      </div>
      <ArrowDown className="size-3.5 text-muted-foreground/70" />
      <svg viewBox="0 0 2 24" className="sr-only" aria-hidden>
        <line x1="1" y1="0" x2="1" y2="24" stroke={`url(#${uid}-beam)`} strokeWidth="2" />
        <defs>
          <linearGradient id={`${uid}-beam`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--davinci-beam, oklch(0.7 0.15 250))" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--davinci-beam, oklch(0.7 0.15 250))" stopOpacity="0.7" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

function PlaneCard({ plane, tapHint }: { plane: IntegrationPlane; tapHint: string }) {
  const tone = planeTone[plane.id]
  const Icon = planeIcons[plane.id]

  return (
    <div
      className={cn(
        'w-full rounded-2xl border border-border bg-card/80 p-3 text-left shadow-sm',
        'transition-all duration-200 hover:border-primary/25 hover:shadow-md',
        tone.ring,
      )}
      data-testid={`integration-plane-${plane.id}`}
    >
      <a
        href={plane.href}
        className="group mb-2 flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-label={`${plane.title} — ${tapHint}`}
      >
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset',
            tone.bg,
            tone.ring,
          )}
        >
          <Icon className={cn('size-4', tone.icon)} aria-hidden />
        </span>
        <span className="text-sm font-semibold text-foreground group-hover:text-primary">
          {plane.title}
        </span>
      </a>
      <ul className="flex flex-wrap gap-1.5">
        {plane.nodes.map((node) => (
          <li key={node.id}>
            <a
              href={node.href}
              className={cn(
                'inline-flex max-w-full rounded-lg border border-border/80 bg-muted/30 px-2 py-1',
                'text-[11px] font-medium leading-tight text-muted-foreground',
                'transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              )}
            >
              {node.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

function CenterHub({
  label,
  sublabel,
  href,
  reduced,
}: {
  label: string
  sublabel: string
  href: string
  reduced: boolean
}) {
  return (
    <a
      href={href}
      className={cn(
        'relative z-[2] mx-auto flex size-[7.25rem] flex-col items-center justify-center rounded-full',
        'border-2 border-[color-mix(in_oklch,var(--davinci-beam)_45%,transparent)]',
        'bg-[color-mix(in_oklch,var(--davinci-beam)_12%,var(--background))]',
        'text-center shadow-lg shadow-primary/10',
        'transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
      )}
      data-testid="integration-hub-center"
    >
      {!reduced ? (
        <motion.span
          className="pointer-events-none absolute inset-0 rounded-full border border-[color-mix(in_oklch,var(--davinci-beam)_35%,transparent)]"
          animate={{ scale: [1, 1.08, 1], opacity: [0.55, 0.15, 0.55] }}
          transition={{ duration: 2.8, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
          aria-hidden
        />
      ) : null}
      <Layers className="mb-1 size-5 text-[var(--davinci-beam)]" aria-hidden />
      <span className="text-sm font-bold leading-none text-foreground">{label}</span>
      <span className="mt-1 text-[10px] font-medium text-muted-foreground">{sublabel}</span>
    </a>
  )
}

function ThemeRoot({
  theme,
  children,
}: {
  theme: IntegrationPlanesTheme
  children: React.ReactNode
}) {
  if (theme === 'dark') {
    return (
      <div className="dark rounded-2xl border border-border bg-gray-950 text-gray-50 [&_.bg-card]:bg-gray-900/90">
        {children}
      </div>
    )
  }
  if (theme === 'light') {
    return (
      <div className="rounded-2xl border border-border bg-white text-gray-900 shadow-sm [&_.bg-card]:bg-white">
        {children}
      </div>
    )
  }
  return <>{children}</>
}

export function RingIntegrationPlanesHub({
  locale: localeProp,
  theme = 'inherit',
  title,
  subtitle,
}: RingIntegrationPlanesHubProps) {
  const routeLocale = useLocale() as Locale
  const locale = localeProp ?? routeLocale
  const copy = getIntegrationHubCopy(locale)
  const reduced = useReducedMotion()
  const uid = useId()

  const displayTitle = title ?? copy.title
  const displaySubtitle = subtitle ?? copy.subtitle

  const aboveCenter = copy.planes.filter((p) => p.id === 'identity' || p.id === 'payments')
  const belowCenter = copy.planes.filter((p) => p.id === 'comms' || p.id === 'mail' || p.id === 'external')

  return (
    <ThemeRoot theme={theme}>
      <figure
        className="ring-widget-integration-hub my-8 w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
        data-theme={theme}
        data-locale={locale}
      >
        <figcaption className="border-b border-border px-4 py-3 md:px-5">
          <p className="text-base font-semibold tracking-tight text-foreground md:text-lg">
            {displayTitle}
          </p>
          {displaySubtitle ? (
            <p className="mt-1 text-xs text-muted-foreground md:text-sm">{displaySubtitle}</p>
          ) : null}
        </figcaption>

        <div className="px-3 py-5 md:px-5 md:py-6">
          {/* Mobile-first vertical: planes above → center → planes below */}
          <div className="mx-auto flex max-w-md flex-col items-stretch lg:hidden">
            {aboveCenter.map((plane) => (
              <React.Fragment key={plane.id}>
                <PlaneCard plane={plane} tapHint={copy.tapHint} />
                <HubConnector reduced={!!reduced} uid={`${uid}-${plane.id}`} />
              </React.Fragment>
            ))}

            <div className="flex justify-center py-1">
              <CenterHub
                label={copy.centerLabel}
                sublabel={copy.centerSublabel}
                href={copy.centerHref}
                reduced={!!reduced}
              />
            </div>

            {belowCenter.map((plane, index) => (
              <React.Fragment key={plane.id}>
                <HubConnector reduced={!!reduced} uid={`${uid}-below-${plane.id}`} />
                <PlaneCard plane={plane} tapHint={copy.tapHint} />
                {index === belowCenter.length - 1 ? null : null}
              </React.Fragment>
            ))}
          </div>

          {/* Wide: center orb with planes in a 3×3 orbit */}
          <div className="relative mx-auto hidden max-w-3xl lg:block">
            <div className="grid grid-cols-3 grid-rows-3 gap-3">
              <div className="col-start-1 row-start-1">
                <PlaneCard plane={copy.planes[0]} tapHint={copy.tapHint} />
              </div>
              <div className="col-start-3 row-start-1">
                <PlaneCard plane={copy.planes[1]} tapHint={copy.tapHint} />
              </div>
              <div className="col-start-1 row-start-2" />
              <div className="col-start-2 row-start-2 flex items-center justify-center">
                <CenterHub
                  label={copy.centerLabel}
                  sublabel={copy.centerSublabel}
                  href={copy.centerHref}
                  reduced={!!reduced}
                />
              </div>
              <div className="col-start-3 row-start-2" />
              <div className="col-start-1 row-start-3">
                <PlaneCard plane={copy.planes[2]} tapHint={copy.tapHint} />
              </div>
              <div className="col-start-2 row-start-3">
                <PlaneCard plane={copy.planes[3]} tapHint={copy.tapHint} />
              </div>
              <div className="col-start-3 row-start-3">
                <PlaneCard plane={copy.planes[4]} tapHint={copy.tapHint} />
              </div>
            </div>
          </div>
        </div>
      </figure>
    </ThemeRoot>
  )
}
